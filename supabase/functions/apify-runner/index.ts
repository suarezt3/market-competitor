// supabase/functions/apify-runner/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { ApifyClient } from "npm:apify-client@^2.8.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// CONFIGURACIÓN DE TAREAS (ZERO-TOUCH GOVERNANCE)
// Catálogo de las 16 Actor Tasks mapeadas por Mercado (COL y MX)
// ==========================================
const TASK_COUNTRY_MAP: Record<string, { country: 'COL' | 'MX'; platform: string; contentType: string; taskName: string }> = {
  // Colombia
  'suarezt~tiktok-profile-col': { country: 'COL', platform: 'tiktok', contentType: 'profile', taskName: 'Tiktok_profile_COL' },
  'suarezt~youtube-videos-col': { country: 'COL', platform: 'youtube', contentType: 'videos', taskName: 'Youtube_videos_COL' },
  'suarezt~facebook-profile-col': { country: 'COL', platform: 'facebook', contentType: 'profile', taskName: 'Facebook_profile_COL' },
  'suarezt~facebook-post-col': { country: 'COL', platform: 'facebook', contentType: 'post', taskName: 'Facebook_post_COL' },
  'suarezt~tiktok-post-col': { country: 'COL', platform: 'tiktok', contentType: 'post', taskName: 'Tiktok_post_COL' },
  'suarezt~instagram-post-col': { country: 'COL', platform: 'instagram', contentType: 'post', taskName: 'Instagram_post_COL' },
  'suarezt~instagram-profile-col': { country: 'COL', platform: 'instagram', contentType: 'profile', taskName: 'Instagram_profile_COL' },
  'suarezt~youtube-shorts-col': { country: 'COL', platform: 'youtube', contentType: 'shorts', taskName: 'Youtube_shorts_COL' },

  // México
  'suarezt~tiktok-profile-mx': { country: 'MX', platform: 'tiktok', contentType: 'profile', taskName: 'Tiktok_profile_MX' },
  'suarezt~youtube-videos-mx': { country: 'MX', platform: 'youtube', contentType: 'videos', taskName: 'Youtube_videos_MX' },
  'suarezt~facebook-post-mx': { country: 'MX', platform: 'facebook', contentType: 'post', taskName: 'Facebook_post_MX' },
  'suarezt~facebook-profile-mx': { country: 'MX', platform: 'facebook', contentType: 'profile', taskName: 'Facebook_profile_MX' },
  'suarezt~tiktok-post-mx': { country: 'MX', platform: 'tiktok', contentType: 'post', taskName: 'Tiktok_post_MX' },
  'suarezt~instagram-profile-mx': { country: 'MX', platform: 'instagram', contentType: 'profile', taskName: 'Instagram_profile_MX' },
  'suarezt~instagram-post-mx': { country: 'MX', platform: 'instagram', contentType: 'post', taskName: 'Instagram_post_MX' },
  'suarezt~youtube-shorts-mx': { country: 'MX', platform: 'youtube', contentType: 'shorts', taskName: 'Youtube_shorts_MX' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const { action = 'get-task-latest', apiTaskId, actorId, inputPayload, runId, country, startDate, endDate } = body;

    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apifyToken) throw new Error('Configuración: APIFY_API_TOKEN no está definido.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const client = new ApifyClient({ token: apifyToken });
    let responseData: any = [];
    let returnedRunId = null;

    const targetTaskId = apiTaskId || actorId;
    const taskInfo = targetTaskId ? TASK_COUNTRY_MAP[targetTaskId.toLowerCase().replace('/', '~')] : null;
    const targetCountry = country || taskInfo?.country || 'COL';

    if (action === 'get-task-latest' || action === 'get-latest') {
      if (!targetTaskId) throw new Error('El parámetro apiTaskId es obligatorio.');
      console.log(`[Apify Runner] Consultando última ejecución exitosa para Tarea: ${targetTaskId}`);

      try {
        const url = `https://api.apify.com/v2/actor-tasks/${targetTaskId}/runs/last/dataset/items?token=${apifyToken}&status=SUCCEEDED`;
        const res = await fetch(url);

        if (res.status === 404) {
          console.log(`[Apify Runner] Tarea ${targetTaskId} tiene 0 runs. Retornando vacío sin error.`);
          responseData = [];
        } else if (!res.ok) {
          console.warn(`[Apify Runner] Respuesta no exitosa (${res.status}) para ${targetTaskId}`);
          responseData = [];
        } else {
          const items = await res.json();
          responseData = Array.isArray(items) ? items : [];

          // Enriquecimiento de datos inmediato
          if (taskInfo && responseData.length > 0) {
            responseData = responseData.map((item: any) => ({
              ...item,
              country: taskInfo.country,
              platform: taskInfo.platform,
              contentType: taskInfo.contentType,
              taskName: taskInfo.taskName,
              __country: taskInfo.country,
              __network: taskInfo.platform,
              _contentType: taskInfo.contentType,
              _isPageProfile: taskInfo.contentType === 'profile'
            }));
          }
        }
      } catch (err: any) {
        console.warn(`[Apify Runner] Excepción al consultar ${targetTaskId}:`, err?.message);
        responseData = [];
      }

    } else if (action === 'run-task' || action === 'run') {
      if (!targetTaskId) throw new Error('El parámetro apiTaskId es obligatorio.');
      console.log(`[Apify Runner] Disparando NUEVA ejecución de Tarea: ${targetTaskId}`);

      const url = `https://api.apify.com/v2/actor-tasks/${targetTaskId}/runs?token=${apifyToken}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputPayload || {})
      });

      if (!res.ok) {
        throw new Error(`Error al disparar tarea ${targetTaskId}: HTTP ${res.status}`);
      }

      const runData = await res.json();
      returnedRunId = runData?.data?.id || null;

      // Registrar metadata de ejecución en Supabase
      if (returnedRunId) {
        await supabase.from('apify_run_metadata').upsert({
          run_id: returnedRunId,
          country: targetCountry,
          task_name: taskInfo?.taskName || targetTaskId,
          api_task_id: targetTaskId,
          platform: taskInfo?.platform,
          content_type: taskInfo?.contentType,
          start_date: startDate,
          end_date: endDate
        }, { onConflict: 'run_id' });
      }

      responseData = [runData?.data];

    } else if (action === 'purge-legacy-data') {
      console.log(`[Apify Runner] Purgando registros antiguos que no pertenecen a las 16 tareas...`);
      const validTaskNames = Object.values(TASK_COUNTRY_MAP).map(t => t.taskName);

      const { error: err1 } = await supabase
        .from('competitor_market_data')
        .delete()
        .not('task_name', 'in', `(${validTaskNames.map(t => `"${t}"`).join(',')})`);

      const { error: err2 } = await supabase
        .from('competitor_market_data')
        .delete()
        .is('task_name', null);

      const { error: err3 } = await supabase
        .from('apify_run_metadata')
        .delete()
        .not('task_name', 'in', `(${validTaskNames.map(t => `"${t}"`).join(',')})`);

      const { error: err4 } = await supabase
        .from('apify_run_metadata')
        .delete()
        .is('task_name', null);

      if (err1 || err2 || err3 || err4) {
        console.warn('[Apify Runner] Advertencia al purgar tablas:', err1?.message || err2?.message || err3?.message || err4?.message);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Datos antiguos purgados correctamente en Supabase.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } else if (action === 'list-runs') {
      console.log(`[Apify Runner] Listando historial filtrado exclusivamente a las 16 tareas oficiales...`);
      const runs = await client.runs().list({ limit: 30, desc: true });

      // Filtrar estrictamente solo ejecuciones asociadas a las 16 Actor Tasks
      const validRuns = runs.items.filter(r => r.actorTaskId && TASK_COUNTRY_MAP[r.actorTaskId.toLowerCase().replace('/', '~')]);
      const runIds = validRuns.map(r => r.id);

      const { data: metaData } = await supabase
        .from('apify_run_metadata')
        .select('run_id, country, task_name, api_task_id, start_date, end_date')
        .in('run_id', runIds);

      const metaMap = (metaData || []).reduce((acc: any, curr: any) => {
        acc[curr.run_id] = curr;
        return acc;
      }, {});

      responseData = validRuns.map(r => {
        const meta = metaMap[r.id];
        const match = r.actorTaskId ? TASK_COUNTRY_MAP[r.actorTaskId.toLowerCase().replace('/', '~')] : undefined;
        const derivedCountry = meta?.country || match?.country || 'COL';
        const derivedTaskName = meta?.task_name || match?.taskName;

        return {
          id: r.id,
          status: r.status,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          usageTotalUsd: r.usageTotalUsd || 0,
          actorId: r.actId,
          actorTaskId: r.actorTaskId,
          taskName: derivedTaskName,
          country: derivedCountry,
          inputStartDate: meta?.start_date,
          inputEndDate: meta?.end_date
        };
      });

    } else if (action === 'get-run-data') {
      if (!runId) throw new Error('El parámetro runId es obligatorio.');
      console.log(`[Apify Runner] Obteniendo dataset del Run ID: ${runId}`);

      const runInfo = await client.run(runId).get();
      if (!runInfo) throw new Error('Historial (Run) no encontrado.');
      returnedRunId = runInfo.id;

      const dataset = await client.dataset(runInfo.defaultDatasetId).listItems();
      responseData = dataset.items;

    } else if (action === 'update-run') {
      if (!runId || !country) throw new Error('Los parámetros runId y country son obligatorios.');
      console.log(`[Apify Runner] Actualizando metadata de ${runId} a ${country}`);

      const { error: dbError } = await supabase
        .from('apify_run_metadata')
        .upsert({ run_id: runId, country }, { onConflict: 'run_id' });

      if (dbError) throw new Error(`Error en base de datos: ${dbError.message}`);
      returnedRunId = runId;
      responseData = [];

    } else {
      throw new Error(`Acción '${action}' no soportada.`);
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData, runId: returnedRunId, action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err: any) {
    console.error('[Apify Runner Error]:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
