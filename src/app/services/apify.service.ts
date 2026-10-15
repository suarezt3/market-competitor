// src/app/services/apify.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  MarketCountryCode,
  PlatformType,
  ContentType,
  ApifyTaskDefinition,
  APIFY_TASKS_CATALOG,
  getTasksByCountry,
  findTaskByApiId,
  findTaskByName,
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
  itemsCount?: number;
  platform?: PlatformType;
  contentType?: ContentType;
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

/**
 * Mapeo oficial de ejecuciones e IDs de tareas en Apify para clasificación automática
 */
export const KNOWN_APIFY_RUNS_MAP: Record<string, {
  taskName: string;
  country: MarketCountryCode;
  platform: PlatformType;
  contentType: ContentType;
  apiTaskId: string;
  approxItems: number;
}> = {
  // TikTok COL (~390 items)
  'BdhLIx2LuYi4CYHya': {
    taskName: 'Tiktok_profile_COL',
    country: 'COL',
    platform: 'tiktok',
    contentType: 'profile',
    apiTaskId: 'suarezt~tiktok-profile-col',
    approxItems: 390
  },
  'QpJnfcU017gOurAn9': {
    taskName: 'Tiktok_profile_COL',
    country: 'COL',
    platform: 'tiktok',
    contentType: 'profile',
    apiTaskId: 'suarezt~tiktok-profile-col',
    approxItems: 390
  },

  // TikTok MX (~350 items)
  '4wbw2tDCUwxHjWOIW': {
    taskName: 'Tiktok_profile_MX',
    country: 'MX',
    platform: 'tiktok',
    contentType: 'profile',
    apiTaskId: 'suarezt~tiktok-profile-mx',
    approxItems: 350
  },
  'li3IJZU2e4MkK1qvB': {
    taskName: 'Tiktok_profile_MX',
    country: 'MX',
    platform: 'tiktok',
    contentType: 'profile',
    apiTaskId: 'suarezt~tiktok-profile-mx',
    approxItems: 350
  },

  // YouTube MX (~168 items)
  'SRhdL03dOczj7zVpO': {
    taskName: 'Youtube_videos_MX',
    country: 'MX',
    platform: 'youtube',
    contentType: 'videos',
    apiTaskId: 'suarezt~youtube-videos-mx',
    approxItems: 168
  },
  'Pj5dHwzZXXWZhZ20z': {
    taskName: 'Youtube_videos_MX',
    country: 'MX',
    platform: 'youtube',
    contentType: 'videos',
    apiTaskId: 'suarezt~youtube-videos-mx',
    approxItems: 168
  },

  // YouTube COL (~73 items)
  'y2E94ckRpl7uFQpJv': {
    taskName: 'Youtube_videos_COL',
    country: 'COL',
    platform: 'youtube',
    contentType: 'videos',
    apiTaskId: 'suarezt~youtube-videos-col',
    approxItems: 73
  },
  'CeQ5xWcXeOWgrTuxA': {
    taskName: 'Youtube_videos_COL',
    country: 'COL',
    platform: 'youtube',
    contentType: 'videos',
    apiTaskId: 'suarezt~youtube-videos-col',
    approxItems: 73
  }
};

@Injectable({
  providedIn: 'root'
})
export class ApifyService {
  private http = inject(HttpClient);
  private supabaseService = inject(SupabaseService);

  // URL de la Edge Function en Supabase (Solo soporta: list-runs, get-run-data, get-latest, run, update-run)
  private readonly EDGE_FUNCTION_URL = 'https://mhfablbqwbjjgkmoyipd.supabase.co/functions/v1/apify-runner';

  // Signal Reactivo Global de Mercado: 'COL' | 'MX' (Por defecto Colombia)
  public readonly selectedMarket = signal<MarketCountryCode>('COL');

  // Token de Apify (almacenable en localStorage o configurable directamente)
  public readonly apifyToken = signal<string>(
    typeof localStorage !== 'undefined' ? localStorage.getItem('apify_token') || '' : ''
  );

  setMarket(market: MarketCountryCode): void {
    this.selectedMarket.set(market);
  }

  setToken(token: string): void {
    const cleanToken = token ? token.trim() : '';
    this.apifyToken.set(cleanToken);
    if (typeof localStorage !== 'undefined') {
      if (cleanToken) {
        localStorage.setItem('apify_token', cleanToken);
      } else {
        localStorage.removeItem('apify_token');
      }
    }
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
   * Clasifica inteligentemente un run de Apify hacia su tarea oficial, país y plataforma
   */
  classifyRun(run: any): {
    taskName: string;
    country: MarketCountryCode;
    platform: PlatformType;
    contentType: ContentType;
    apiTaskId: string;
    approxItems?: number;
  } | null {
    if (!run) return null;

    // 1. Mapeo exacto por ID de run o por actorTaskId interno de Apify
    if (run.id && KNOWN_APIFY_RUNS_MAP[run.id]) {
      return KNOWN_APIFY_RUNS_MAP[run.id];
    }
    if (run.actorTaskId && KNOWN_APIFY_RUNS_MAP[run.actorTaskId]) {
      return KNOWN_APIFY_RUNS_MAP[run.actorTaskId];
    }

    // 2. Si el run ya tiene taskName oficial en su metadata
    if (run.taskName && isValidTaskName(run.taskName)) {
      const task = findTaskByName(run.taskName);
      if (task) {
        return {
          taskName: task.taskName,
          country: task.country,
          platform: task.platform,
          contentType: task.contentType,
          apiTaskId: task.apiTaskId
        };
      }
    }

    // 3. Si actorTaskId coincide con algún slug del catálogo
    if (run.actorTaskId) {
      const task = findTaskByApiId(run.actorTaskId);
      if (task) {
        return {
          taskName: task.taskName,
          country: task.country,
          platform: task.platform,
          contentType: task.contentType,
          apiTaskId: task.apiTaskId
        };
      }
    }

    return null;
  }

  // ============================================================================
  // ESTRATEGIA INTELIGENTE DE OBTENCIÓN DE DATOS (CON TOKEN DIRECTO O EDGE FUNCTION)
  // ============================================================================

  /**
   * Obtiene los datos consolidados del mercado especificado ('COL' o 'MX').
   * Prioridad 1: Si hay apifyToken(), consulta directamente /v2/actor-tasks/{apiTaskId}/runs/last/dataset/items
   * Prioridad 2: Si no hay token, consulta 'list-runs' en la Edge Function remota de Supabase
   *              y luego descarga los ítems con 'get-run-data'.
   */
  getOmnichannelLatestData(
    market: MarketCountryCode | MarketCountry = 'COL'
  ): Observable<any[]> {
    const marketCode: MarketCountryCode = market === 'México' || market === 'MX' ? 'MX' : 'COL';
    const tasks = getTasksByCountry(marketCode);
    return from(this.fetchMarketTasks(tasks, marketCode));
  }

  /**
   * Obtiene los items de una tarea específica con tolerancia a 0 runs (404)
   */
  async getTaskItems(task: ApifyTaskDefinition): Promise<any[]> {
    const token = this.apifyToken();

    // 1. Conexión directa a Apify si existe token
    if (token) {
      try {
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
      } catch (err: any) {
        console.warn(`[ApifyService] Fallo consulta directa para ${task.taskName}:`, err?.message);
      }
    }

    // 2. Consulta a través de proxy local del servidor
    try {
      const proxyUrl = this.getAbsoluteUrl(`/api/apify/tasks/${task.apiTaskId}/items`);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          return this.enrichItems(items, task);
        }
      }
    } catch {
      // Continuar al fallback de Edge Function
    }

    // 3. Fallback inteligente usando exclusivamente 'list-runs' y 'get-run-data' en la Edge Function
    return await this.fetchTaskViaEdgeFunction(task);
  }

  /**
   * Descarga los datos de una tarea específica usando las acciones soportadas de la Edge Function:
   * action: 'list-runs' -> localizar run exitoso -> action: 'get-run-data'
   */
  private async fetchTaskViaEdgeFunction(task: ApifyTaskDefinition): Promise<any[]> {
    try {
      const runs = await this.fetchEdgeFunctionRuns();
      if (!runs || runs.length === 0) return [];

      // Buscar run que corresponda a esta tarea
      const targetRun = runs.find(r => {
        const classified = this.classifyRun(r);
        return (
          classified?.taskName.toLowerCase() === task.taskName.toLowerCase() ||
          r.actorTaskId === task.apiTaskId ||
          (r.taskName && r.taskName.toLowerCase() === task.taskName.toLowerCase())
        );
      });

      if (!targetRun || !targetRun.id) {
        // Tarea sin ejecuciones en la nube (ej: Instagram o Facebook con 0 runs)
        return [];
      }

      return await this.getRunItems(targetRun.id, task);
    } catch (err: any) {
      console.warn(`[ApifyService] Error en fetchTaskViaEdgeFunction para ${task.taskName}:`, err?.message);
      return [];
    }
  }

  /**
   * Obtiene la lista cruda de ejecuciones desde la Edge Function mediante action: 'list-runs'
   */
  private async fetchEdgeFunctionRuns(): Promise<any[]> {
    try {
      const res = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-runs' })
      });

      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } catch (err: any) {
      console.warn('[ApifyService] Error consultando list-runs en Edge Function:', err?.message);
      return [];
    }
  }

  /**
   * Descarga los ítems de un run específico usando action: 'get-run-data' en la Edge Function
   * o directamente de Apify si se cuenta con token
   */
  async getRunItems(runId: string, task?: ApifyTaskDefinition): Promise<any[]> {
    const token = this.apifyToken();

    if (token) {
      try {
        const url = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items)) {
            return task ? this.enrichItems(items, task) : items;
          }
        }
      } catch (err: any) {
        console.warn(`[ApifyService] Error directo para run ${runId}:`, err?.message);
      }
    }

    try {
      const res = await fetch(this.EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-run-data',
          runId
        })
      });

      if (!res.ok) return [];
      const json = await res.json();
      const items = Array.isArray(json?.data) ? json.data : [];
      return task ? this.enrichItems(items, task) : items;
    } catch (err: any) {
      console.warn(`[ApifyService] Error obteniendo datos para run ${runId}:`, err?.message);
      return [];
    }
  }

  /**
   * Ejecuta la sincronización inteligente de mercado con tolerancia absoluta a tareas con 0 runs
   */
  private async fetchMarketTasks(tasks: ApifyTaskDefinition[], marketCode: MarketCountryCode): Promise<any[]> {
    const token = this.apifyToken();
    const aggregatedItems: any[] = [];

    // ESTRATEGIA A: Si hay token directo de Apify, consultar concurrentemente las tareas
    if (token) {
      const fetchPromises = tasks.map(task => this.getTaskItems(task));
      const results = await Promise.allSettled(fetchPromises);

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
          aggregatedItems.push(...res.value);
        }
      }
    } else {
      // ESTRATEGIA B: Sin token en el cliente -> Usar la lista de runs de la Edge Function
      const runs = await this.fetchEdgeFunctionRuns();

      // Filtrar y clasificar los runs que pertenecen al mercado seleccionado
      for (const run of runs) {
        if (run.status !== 'SUCCEEDED') continue;

        const classified = this.classifyRun(run);
        if (!classified) continue;

        // Verificar coincidencia estricta con el mercado seleccionado
        if (classified.country !== marketCode) continue;

        const taskDef: ApifyTaskDefinition = {
          taskName: classified.taskName,
          apiTaskId: classified.apiTaskId,
          country: classified.country,
          platform: classified.platform,
          contentType: classified.contentType
        };

        const items = await this.getRunItems(run.id, taskDef);
        if (Array.isArray(items) && items.length > 0) {
          // Detección heurística adicional de país si fuera necesaria
          const enriched = this.enrichItems(items, taskDef);
          aggregatedItems.push(...enriched);
        }
      }
    }

    // Sincronización limpia en Supabase: Reemplazar los datos del país con los resultados de las tareas activas
    if (aggregatedItems.length > 0) {
      this.supabaseService.replaceMarketData(marketCode, aggregatedItems).subscribe();
    }

    return aggregatedItems;
  }

  /**
   * Inyecta los campos estrictos de país, plataforma, contentType y taskName
   */
  public enrichItems(items: any[], task: ApifyTaskDefinition): any[] {
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

    // Si no hay token en el cliente, usar proxy o Edge Function con action: 'run'
    return this.http.post<ApifyResponse>(`/api/apify/tasks/${apiTaskId}/runs`, inputPayload || {}).pipe(
      catchError(() => {
        return this.http.post<ApifyResponse>(this.EDGE_FUNCTION_URL, {
          action: 'run',
          actorTaskId: apiTaskId,
          country,
          inputPayload
        });
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Consulta el historial de ejecuciones usando exclusivamente action: 'list-runs'
   * Mapea cada run al catálogo oficial de 16 Actor Tasks y filtra por mercado
   */
  listTaskRuns(market?: MarketCountryCode): Observable<ApifyRunRecord[]> {
    const targetMarket = market || this.selectedMarket();

    return this.http.post<{ success: boolean; data?: any[] }>(this.EDGE_FUNCTION_URL, {
      action: 'list-runs'
    }).pipe(
      map(res => {
        const raw = res.data || [];
        const mappedRuns: ApifyRunRecord[] = [];

        for (const rawRun of raw) {
          const classified = this.classifyRun(rawRun);
          const taskName = classified?.taskName || rawRun.taskName || '';
          const country: MarketCountryCode = classified?.country ||
            (rawRun.country === 'Colombia' || rawRun.country === 'COL' ? 'COL' : 'MX');
          const approxItems = classified?.approxItems || 0;

          // Solo incluir si coincide con el catálogo oficial
          if (isValidTaskName(taskName)) {
            // Filtrar por el mercado seleccionado
            if (!targetMarket || country === targetMarket) {
              mappedRuns.push({
                id: rawRun.id,
                status: rawRun.status || 'SUCCEEDED',
                startedAt: rawRun.startedAt || new Date().toISOString(),
                finishedAt: rawRun.finishedAt || new Date().toISOString(),
                usageTotalUsd: rawRun.usageTotalUsd ?? 0,
                actorId: rawRun.actorId || '',
                actorTaskId: classified?.apiTaskId || rawRun.actorTaskId,
                taskName: taskName,
                country: country,
                itemsCount: rawRun.itemsCount || approxItems,
                platform: classified?.platform,
                contentType: classified?.contentType,
                defaultDatasetId: rawRun.defaultDatasetId || rawRun.id
              });
            }
          }
        }

        return mappedRuns;
      }),
      catchError((err) => {
        console.warn('[ApifyService] Error listando runs con action: list-runs:', err?.message);
        return of([]);
      })
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
