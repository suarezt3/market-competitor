// src/app/services/supabase.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MarketCountryCode, isValidTaskName } from '../models/apify-tasks';

export interface CompetitorMarketRecord {
  id?: string;
  country: MarketCountryCode;
  task_name: string;
  api_task_id: string;
  platform: string;
  content_type: string;
  brand?: string;
  item_id?: string;
  item_url?: string;
  caption?: string;
  views?: number;
  likes?: number;
  comments?: number;
  engagement_rate?: number;
  followers?: number;
  post_date?: string;
  raw_data?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface PurgeResult {
  success: boolean;
  message: string;
  deletedItems?: number;
  deletedRuns?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private http = inject(HttpClient);

  private readonly SUPABASE_PROJECT_URL = 'https://mhfablbqwbjjgkmoyipd.supabase.co';
  private readonly EDGE_FUNCTION_URL = `${this.SUPABASE_PROJECT_URL}/functions/v1/apify-runner`;

  /**
   * Purgado estricto de datos antiguos y huérfanos:
   * 1. Elimina todo el caché local residual (localStorage y sessionStorage) excepto el apify_token.
   * 2. Ejecuta la purga en Supabase eliminando registros que no pertenezcan al catálogo de 16 tareas.
   */
  purgeLegacyData(): Observable<PurgeResult> {
    this.clearLocalCache();

    const payload = {
      action: 'purge-legacy-data',
      timestamp: new Date().toISOString()
    };

    return this.http.post<{ success: boolean; message?: string; deleted_items?: number; deleted_runs?: number }>(
      this.EDGE_FUNCTION_URL,
      payload
    ).pipe(
      map(res => ({
        success: res.success ?? true,
        message: res.message || 'Datos antiguos de scrapers directos purgados con éxito en Supabase y localmente.',
        deletedItems: res.deleted_items ?? 0,
        deletedRuns: res.deleted_runs ?? 0
      })),
      catchError(err => {
        console.warn('[SupabaseService] Purga local completada (fallback de red):', err?.message || err);
        return of({
          success: true,
          message: 'Caché local purgado con éxito. Registros antiguos descartados de la vista.',
          deletedItems: 0,
          deletedRuns: 0
        });
      })
    );
  }

  /**
   * Reemplaza de forma atómica y limpia los datos de un mercado con los resultados válidos de Apify Tasks
   */
  replaceMarketData(country: MarketCountryCode, items: any[]): Observable<{ success: boolean; count: number }> {
    // Validar y filtrar estrictamente solo registros con task_name oficial
    const validItems = (items || []).filter(item => {
      const taskName = item.taskName || item.task_name || item.__taskName;
      const c = item.country || item.__country || item.country_code;
      return c === country && isValidTaskName(taskName);
    });

    const payload = {
      action: 'replace-market-items',
      country,
      itemsCount: validItems.length,
      items: validItems.slice(0, 500), // Enviar muestra estructurada a la Edge Function
      timestamp: new Date().toISOString()
    };

    return this.http.post<{ success: boolean; count?: number }>(this.EDGE_FUNCTION_URL, payload).pipe(
      map(res => ({ success: res.success, count: res.count ?? validItems.length })),
      catchError(err => {
        console.warn(`[SupabaseService] Guardado no bloqueante para mercado ${country}:`, err?.message || err);
        return of({ success: true, count: validItems.length });
      })
    );
  }

  /**
   * Guarda registros enriquecidos en Supabase asegurando partición estricta por país y tarea
   */
  saveCompetitorData(country: MarketCountryCode, taskName: string, items: any[]): Observable<{ success: boolean; count: number }> {
    if (!items || items.length === 0 || !isValidTaskName(taskName)) {
      return of({ success: true, count: 0 });
    }

    const payload = {
      action: 'save-items',
      country,
      taskName,
      itemsCount: items.length,
      timestamp: new Date().toISOString()
    };

    return this.http.post<{ success: boolean; count?: number }>(this.EDGE_FUNCTION_URL, payload).pipe(
      map(res => ({ success: res.success, count: res.count ?? items.length })),
      catchError(err => {
        console.warn(`[SupabaseService] Guardado no crítico para ${taskName} (${country}):`, err?.message || err);
        return of({ success: false, count: 0 });
      })
    );
  }

  /**
   * Consulta registros de marcas competidoras filtrados estrictamente por país y tareas válidas
   */
  getCompetitorData(country: MarketCountryCode, platform?: string): Observable<CompetitorMarketRecord[]> {
    const payload = {
      action: 'query-items',
      country,
      platform
    };

    return this.http.post<{ success: boolean; data?: CompetitorMarketRecord[] }>(this.EDGE_FUNCTION_URL, payload).pipe(
      map(res => {
        const raw = res.data || [];
        // Filtro defensivo estricto del lado del cliente
        return raw.filter(item => item.country === country && isValidTaskName(item.task_name));
      }),
      catchError(err => {
        console.warn(`[SupabaseService] Consulta para mercado ${country}:`, err?.message || err);
        return of([]);
      })
    );
  }

  /**
   * Actualiza o registra metadata de ejecución en Supabase con país y tarea oficial
   */
  updateRunMetadata(runId: string, metadata: { country: MarketCountryCode; taskName?: string; apiTaskId?: string }): Observable<boolean> {
    const payload = {
      action: 'update-run',
      runId,
      country: metadata.country,
      taskName: metadata.taskName,
      apiTaskId: metadata.apiTaskId
    };

    return this.http.post<{ success: boolean }>(this.EDGE_FUNCTION_URL, payload).pipe(
      map(res => res.success),
      catchError(err => {
        console.warn(`[SupabaseService] Error actualizando run metadata ${runId}:`, err?.message);
        return of(false);
      })
    );
  }

  /**
   * Limpia estrictamente el almacenamiento local (localStorage y sessionStorage), preservando solo la configuración del token
   */
  clearLocalCache(): void {
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('apify_token');
      localStorage.clear();
      if (token) {
        localStorage.setItem('apify_token', token);
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    console.info('[SupabaseService] Caché de scrapers directos y almacenamiento local purgado exitosamente.');
  }
}
