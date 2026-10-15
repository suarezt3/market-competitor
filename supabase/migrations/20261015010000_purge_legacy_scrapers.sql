-- supabase/migrations/20261015010000_purge_legacy_scrapers.sql
-- Purga estricta de datos antiguos extraídos por scrapers directos sin Actor Task oficial

-- 1. Políticas de eliminación seguras para sincronización limpia y purga
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow delete competitor_market_data'
  ) THEN
    CREATE POLICY "Allow delete competitor_market_data"
      ON public.competitor_market_data FOR DELETE
      TO anon, authenticated, service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apify_run_metadata' AND policyname = 'Allow delete apify_run_metadata'
  ) THEN
    CREATE POLICY "Allow delete apify_run_metadata"
      ON public.apify_run_metadata FOR DELETE
      TO anon, authenticated, service_role
      USING (true);
  END IF;
END $$;

-- 2. Función PL/pgSQL para purgar registros huérfanos o de scrapers directos antiguos
CREATE OR REPLACE FUNCTION public.purge_legacy_competitor_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_items integer := 0;
  deleted_runs integer := 0;
BEGIN
  -- Eliminar datos de marcas que no provengan del catálogo oficial de 16 Actor Tasks
  DELETE FROM public.competitor_market_data
  WHERE task_name IS NULL
     OR task_name NOT IN (
       'Tiktok_profile_COL', 'Youtube_videos_COL', 'Facebook_profile_COL', 'Facebook_post_COL',
       'Tiktok_post_COL', 'Instagram_post_COL', 'Instagram_profile_COL', 'Youtube_shorts_COL',
       'Tiktok_profile_MX', 'Youtube_videos_MX', 'Facebook_post_MX', 'Facebook_profile_MX',
       'Tiktok_post_MX', 'Instagram_profile_MX', 'Instagram_post_MX', 'Youtube_shorts_MX'
     )
     OR country NOT IN ('COL', 'MX')
     OR created_at < '2026-10-01'::timestamptz;

  GET DIAGNOSTICS deleted_items = ROW_COUNT;

  -- Eliminar metadata de ejecuciones correspondientes a scrapers directos anteriores
  DELETE FROM public.apify_run_metadata
  WHERE task_name IS NULL
     OR task_name NOT IN (
       'Tiktok_profile_COL', 'Youtube_videos_COL', 'Facebook_profile_COL', 'Facebook_post_COL',
       'Tiktok_post_COL', 'Instagram_post_COL', 'Instagram_profile_COL', 'Youtube_shorts_COL',
       'Tiktok_profile_MX', 'Youtube_videos_MX', 'Facebook_post_MX', 'Facebook_profile_MX',
       'Tiktok_post_MX', 'Instagram_profile_MX', 'Instagram_post_MX', 'Youtube_shorts_MX'
     )
     OR created_at < '2026-10-01'::timestamptz;

  GET DIAGNOSTICS deleted_runs = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_items', deleted_items,
    'deleted_runs', deleted_runs,
    'purged_at', NOW()
  );
END;
$$;
