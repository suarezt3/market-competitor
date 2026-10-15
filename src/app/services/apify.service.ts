// src/app/services/apify.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  MarketCountryCode,
  PlatformType,
  ApifyTaskDefinition,
  APIFY_TASKS_CATALOG,
  getTasksByCountry,
  findTaskByApiId,
  isValidTaskName
} from '../models/apify-tasks';
import { SupabaseService } from './supabase.service';

export type MarketCountry = 'Colombia' | 'México';

export interface ApifyRunOptions {
  memoryMbytes?: number;
  timeoutSecs?: number;
  [key: string]: any;
}

export interface ApifyRunStats {
  computeUnits?: number;
  memAvgBytes?: number;
  memMaxBytes?: number;
  cpuAvgUsage?: number;
  durationMillis?: number;
  [key: string]: any;
}

export interface ApifyRunRecord {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  usageTotalUsd: number;
  actorId: string;
  actorTaskId?: string;
  taskName?: string;
  country?: MarketCountry | MarketCountryCode;
  inputStartDate?: string;
  inputEndDate?: string;
  defaultDatasetId?: string;
  defaultKeyValueStoreId?: string;
  defaultRequestQueueId?: string;
  buildId?: string;
  buildNumber?: string;
  exitCode?: number;
  statusMessage?: string;
  stats?: ApifyRunStats;
  usage?: Record<string, any>;
  options?: ApifyRunOptions;
  [key: string]: any;
}

export interface ApifyResponse<T = any> {
  success: boolean;
  data?: T[];
  runId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApifyService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);

  // URL de la Edge Function en Supabase
  private readonly EDGE_FUNCTION_URL = 'https://mhfablbqwbjjgkmoyipd.supabase.co/functions/v1/apify-runner';

  // Signal Reactivo Global de Mercado: 'COL' | 'MX' (Por defecto Colombia)
  public readonly selectedMarket = signal<MarketCountryCode>('COL');

  // Token de Apify (almacenable en localStorage o configurable)
  public readonly apifyToken = signal<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('apify_token') || '' : ''
  );

  setMarket(market: MarketCountryCode): void {
    this.selectedMarket.set(market);
  }

  setToken(token: string): void {
    this.apifyToken.set(token);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apify_token', token);
    }
  }

  // ============================================================================
  // PASO 1 Y 2: CONSULTA EXCLUSIVA DE ACTOR TASKS CON TOLERANCIA A 0 RUNS
  // ============================================================================

  /**
   * Obtiene los datos consolidados de las 8 tareas del mercado especificado ('COL' o 'MX').
   * Única fuente permitida: /v2/actor-tasks/{apiTaskId}/runs/last/dataset/items?status=SUCCEEDED
   * Maneja tareas con 0 ejecuciones (404) retornando [] sin lanzar error global.
   * Enriquece cada ítem con: country, country_code, platform, contentType, taskName.
   */
  getOmnichannelLatestData(
    market: MarketCountryCode | MarketCountry = 'COL'
  ): Observable<any[]> {
    const marketCode: MarketCountryCode = market === 'México' || market === 'MX' ? 'MX' : 'COL';
    const tasks = getTasksByCountry(marketCode);
    return from(this.fetchMarketTasks(tasks, marketCode));
  }

  /**
   * Resuelve URLs relativas a absolutas para evitar 'TypeError: Invalid URL' en Node.js SSR
   */
  private getAbsoluteUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
    }
    const port = (typeof process !== 'undefined' && process.env?.['PORT']) || 3000;
    return `http://127.0.0.1:${port}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * Obtiene los items de una tarea específica con tolerancia a 0 runs (404)
   * y fallback transparente a Edge Function si no hay token directo o falla el proxy.
   */
  async getTaskItems(task: ApifyTaskDefinition): Promise<any[]> {
    const token = this.apifyToken();
    try {
      if (token) {
        const directUrl = `https://api.apify.com/v2/actor-tasks/${task.apiTaskId}/runs/last/dataset/items?token=${encodeURIComponent(token)}&status=SUCCEEDED`;
        const response = await fetch(directUrl);

        if (response.status === 404) {
          console.info(`[ApifyService] Tarea oficial '${task.taskName}' tiene 0 ejecuciones exitosas (404).`);
          return [];
        }

        if (response.ok) {
          const items = await response.json();
          return Array.isArray(items) ? this.enrichItems(items, task) : [];
        }
      }

      // Endpoint proxy resuelto con URL absoluta segura
      const proxyUrl = this.getAbsoluteUrl(`/api/apify/tasks/${task.apiTaskId}/items`);
      const response = await fetch(proxyUrl);

      if (response.status === 404) {
        return [];
      }

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          return this.enrichItems(items, task);
        }
      }

      // Respaldo mediante Edge Function oficial de Supabase
      return await this.fetchViaEdgeFunction(task);
    } catch {
      // Fallback a Edge Function ante cualquier error de red o timeout
      return await this.fetchViaEdgeFunction(task);
    }
  }

  /**
   * Ejecuta en paralelo las tareas del país con Promise.allSettled y enriquece cada ítem
   */
  private async fetchMarketTasks(tasks: ApifyTaskDefinition[], marketCode: MarketCountryCode): Promise<any[]> {
    const fetchPromises = tasks.map(task => this.getTaskItems(task));

    // Promise.allSettled para aislar fallos y permitir que las tareas con datos carguen siempre
    const results = await Promise.allSettled(fetchPromises);
    const aggregatedItems: any[] = [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const task = tasks[i];

      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
        aggregatedItems.push(...res.value);
      } else if (res.status === 'rejected') {
        console.warn(`[ApifyService] Fallo en tarea ${task.taskName} (0 runs o error de red). Ignorado.`);
      }
    }

    // Sincronización limpia en Supabase: Reemplazar los datos del país con los resultados de las tareas activas
    if (aggregatedItems.length > 0) {
      this.supabaseService.replaceMarketData(marketCode, aggregatedItems).subscribe();
    }

    return aggregatedItems;
  }

  /**
   * Consulta a través de la Edge Function de Supabase usando el endpoint de Actor Task
   */
  private async fetchViaEdgeFunction(task: ApifyTaskDefinition): Promise<any[]> {
    try {
      const res = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-task-latest',
          apiTaskId: task.apiTaskId,
          taskName: task.taskName,
          country: task.country
        })
      });

      if (!res.ok) return [];
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      return this.enrichItems(items, task);
    } catch {
      return [];
    }
  }

  /**
   * Inyecta los campos estrictos de país, plataforma, contentType y taskName
   */
  private enrichItems(items: any[], task: ApifyTaskDefinition): any[] {
    const isProfile = task.contentType === 'profile';
    const legacyCountry = task.country === 'COL' ? 'Colombia' : 'México';

    return items.map(item => ({
      ...item,
      // Campos normalizados de la arquitectura
      country: task.country,
      country_code: task.country,
      platform: task.platform,
      contentType: task.contentType,
      taskName: task.taskName,
      task_name: task.taskName,
      apiTaskId: task.apiTaskId,
      api_task_id: task.apiTaskId,
      // Retrocompatibilidad con visor y gráficas
      __country: task.country,
      __countryName: legacyCountry,
      __network: task.platform,
      __contentType: task.contentType,
      __taskName: task.taskName,
      _contentType: task.contentType,
      _isPageProfile: isProfile
    }));
  }

  /**
   * Dispara una nueva ejecución de una Actor Task de Apify
   * Endpoint oficial: POST https://api.apify.com/v2/actor-tasks/{apiTaskId}/runs?token={APIFY_TOKEN}
   */
  triggerTaskRun(apiTaskId: string, inputPayload?: Record<string, any>): Observable<any> {
    const token = this.apifyToken();
    const task = findTaskByApiId(apiTaskId);
    const country = task ? task.country : this.selectedMarket();

    if (token) {
      const url = `https://api.apify.com/v2/actor-tasks/${apiTaskId}/runs?token=${encodeURIComponent(token)}`;
      return this.http.post(url, inputPayload || {}).pipe(
        map((res: any) => {
          if (res?.data?.id) {
            this.supabaseService.updateRunMetadata(res.data.id, {
              country,
              taskName: task?.taskName,
              apiTaskId
            }).subscribe();
          }
          return res;
        }),
        catchError(this.handleError)
      );
    }

    // Si no hay token en el cliente, usar Edge Function o proxy
    return this.http.post<ApifyResponse>(`/api/apify/tasks/${apiTaskId}/runs`, inputPayload || {}).pipe(
      catchError(() => {
        return this.http.post<ApifyResponse>(this.EDGE_FUNCTION_URL, {
          action: 'run-task',
          apiTaskId,
          country,
          inputPayload
        });
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Consulta el historial de ejecuciones filtrando estrictamente las 16 Actor Tasks oficiales
   */
  listTaskRuns(market?: MarketCountryCode): Observable<ApifyRunRecord[]> {
    const targetMarket = market || this.selectedMarket();
    return this.http.post<ApifyResponse<ApifyRunRecord>>(this.EDGE_FUNCTION_URL, {
      action: 'list-task-runs',
      country: targetMarket
    }).pipe(
      map(res => {
        const raw = res.data || [];
        return raw.filter(r => {
          const tName = r.taskName || '';
          return isValidTaskName(tName) && (r.country === targetMarket || tName.includes(`_${targetMarket}`));
        });
      }),
      catchError(() => of([]))
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error de red comunicando con Apify.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      errorMessage = error.error?.error || `Error del servidor: código ${error.status}`;
    }
    console.error('[ApifyService Error]:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
