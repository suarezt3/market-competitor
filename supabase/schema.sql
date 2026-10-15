-- supabase/schema.sql
-- Esquema de Base de Datos para Market Competitor Data Platform
-- Almacenamiento, Gobernanza y Partición por Mercado (Colombia COL / México MX)

-- 1. Tabla de Metadata de Ejecuciones de Apify
CREATE TABLE IF NOT EXISTS public.apify_run_metadata (
  run_id VARCHAR(100) PRIMARY KEY,
  country VARCHAR(10) NOT NULL DEFAULT 'COL' CHECK (country IN ('COL', 'MX', 'Colombia', 'México')),
  task_name VARCHAR(120),
  api_task_id VARCHAR(120),
  platform VARCHAR(50),
  content_type VARCHAR(50),
  start_date VARCHAR(50),
  end_date VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas de metadata por país y tarea
CREATE INDEX IF NOT EXISTS idx_apify_run_country ON public.apify_run_metadata(country);
CREATE INDEX IF NOT EXISTS idx_apify_run_task ON public.apify_run_metadata(task_name);

-- 2. Tabla Principal de Datos de Marcas Competidoras
CREATE TABLE IF NOT EXISTS public.competitor_market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country VARCHAR(10) NOT NULL CHECK (country IN ('COL', 'MX')),
  task_name VARCHAR(120) NOT NULL,
  api_task_id VARCHAR(120) NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'tiktok', 'youtube', 'instagram')),
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'profile', 'videos', 'shorts')),
  brand VARCHAR(120),
  item_id VARCHAR(255),
  item_url TEXT,
  caption TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  engagement_rate NUMERIC(8, 4) DEFAULT 0,
  followers BIGINT DEFAULT 0,
  post_date TIMESTAMPTZ,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices compuestos para alto rendimiento en filtros de Dashboard
CREATE INDEX IF NOT EXISTS idx_comp_market_country ON public.competitor_market_data(country);
CREATE INDEX IF NOT EXISTS idx_comp_market_country_platform ON public.competitor_market_data(country, platform);
CREATE INDEX IF NOT EXISTS idx_comp_market_brand ON public.competitor_market_data(country, brand);
CREATE INDEX IF NOT EXISTS idx_comp_market_date ON public.competitor_market_data(post_date DESC);
CREATE INDEX IF NOT EXISTS idx_comp_market_task ON public.competitor_market_data(task_name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - POLÍTICAS DE ACCESO
-- ============================================================================

-- Habilitar RLS en ambas tablas
ALTER TABLE public.apify_run_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_market_data ENABLE ROW LEVEL SECURITY;

-- Políticas para apify_run_metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apify_run_metadata' AND policyname = 'Allow select on apify_run_metadata'
  ) THEN
    CREATE POLICY "Allow select on apify_run_metadata"
      ON public.apify_run_metadata FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apify_run_metadata' AND policyname = 'Allow insert on apify_run_metadata'
  ) THEN
    CREATE POLICY "Allow insert on apify_run_metadata"
      ON public.apify_run_metadata FOR INSERT
      TO anon, authenticated, service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'apify_run_metadata' AND policyname = 'Allow update on apify_run_metadata'
  ) THEN
    CREATE POLICY "Allow update on apify_run_metadata"
      ON public.apify_run_metadata FOR UPDATE
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

-- Políticas para competitor_market_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow read competitor_market_data by market'
  ) THEN
    CREATE POLICY "Allow read competitor_market_data by market"
      ON public.competitor_market_data FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow insert competitor_market_data'
  ) THEN
    CREATE POLICY "Allow insert competitor_market_data"
      ON public.competitor_market_data FOR INSERT
      TO anon, authenticated, service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow update competitor_market_data'
  ) THEN
    CREATE POLICY "Allow update competitor_market_data"
      ON public.competitor_market_data FOR UPDATE
      TO anon, authenticated, service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow delete competitor_market_data'
  ) THEN
    CREATE POLICY "Allow delete competitor_market_data"
      ON public.competitor_market_data FOR DELETE
      TO anon, authenticated, service_role
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- FUNCIÓN DE PURGA ESTRICTA DE SCRAPERS ANTIGUOS Y REGISTROS HUÉRFANOS
-- ============================================================================
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
