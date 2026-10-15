-- supabase/migrations/20261015000000_competitor_market_data.sql
-- Migración para soporte de 16 Actor Tasks y partición por mercado COL y MX

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

CREATE INDEX IF NOT EXISTS idx_apify_run_country ON public.apify_run_metadata(country);

CREATE TABLE IF NOT EXISTS public.competitor_market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country VARCHAR(10) NOT NULL CHECK (country IN ('COL', 'MX')),
  task_name VARCHAR(120) NOT NULL,
  api_task_id VARCHAR(120) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_comp_market_country ON public.competitor_market_data(country);
CREATE INDEX IF NOT EXISTS idx_comp_market_country_platform ON public.competitor_market_data(country, platform);

ALTER TABLE public.apify_run_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_market_data ENABLE ROW LEVEL SECURITY;

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
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow read competitor_market_data'
  ) THEN
    CREATE POLICY "Allow read competitor_market_data"
      ON public.competitor_market_data FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competitor_market_data' AND policyname = 'Allow write competitor_market_data'
  ) THEN
    CREATE POLICY "Allow write competitor_market_data"
      ON public.competitor_market_data FOR INSERT
      TO anon, authenticated, service_role
      WITH CHECK (true);
  END IF;
END $$;
