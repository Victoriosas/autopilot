-- Victoriosa Autopilot - Sourcing Agent Migration
-- Run this in Supabase SQL Editor

-- 1. Sourcing Configuration
CREATE TABLE IF NOT EXISTS sourcing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_interval INTEGER DEFAULT 21600,
  is_enabled BOOLEAN DEFAULT true,
  categories TEXT[] DEFAULT ARRAY['Electronics', 'Home & Garden', 'Beauty & Health', 'Fashion'],
  min_price DECIMAL DEFAULT 5,
  max_price DECIMAL DEFAULT 100,
  min_rating DECIMAL DEFAULT 4.0,
  min_margin DECIMAL DEFAULT 30,
  auto_publish_score INTEGER DEFAULT 85,
  max_products_per_run INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sourcing Runs History
CREATE TABLE IF NOT EXISTS sourcing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'running',
  products_found INTEGER DEFAULT 0,
  products_published INTEGER DEFAULT 0,
  products_draft INTEGER DEFAULT 0,
  products_rejected INTEGER DEFAULT 0,
  api_calls_used INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. Discovered Products
CREATE TABLE IF NOT EXISTS discovered_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourcing_run_id UUID REFERENCES sourcing_runs(id),
  source TEXT DEFAULT 'cj_dropshipping',
  source_id TEXT,
  source_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL,
  original_price DECIMAL,
  images TEXT[],
  category TEXT,
  rating DECIMAL,
  review_count INTEGER,
  shipping_cost DECIMAL,
  shipping_time TEXT,
  supplier_name TEXT,
  supplier_rating DECIMAL,
  margin_percentage DECIMAL,
  ai_score INTEGER,
  ai_analysis JSONB,
  status TEXT DEFAULT 'pending',
  published_product_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add sourcing columns to products table
DO $$ BEGIN
  ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS source_id TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS sourcing_score INTEGER;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS sourcing_analysis JSONB;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_url TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_sku TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_sourcing_runs_status ON sourcing_runs(status);
CREATE INDEX IF NOT EXISTS idx_sourcing_runs_started_at ON sourcing_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_products_status ON discovered_products(status);
CREATE INDEX IF NOT EXISTS idx_discovered_products_score ON discovered_products(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_products_source ON discovered_products(source);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
CREATE INDEX IF NOT EXISTS idx_products_sourcing_score ON products(sourcing_score);

-- 6. Seed default config
INSERT INTO sourcing_config (is_enabled, categories, min_price, max_price, auto_publish_score)
VALUES (true, ARRAY['Electronics', 'Home & Garden', 'Beauty & Health', 'Fashion'], 5, 100, 85)
ON CONFLICT DO NOTHING;

-- 7. Enable RLS
ALTER TABLE sourcing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_products ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies (allow service role full access)
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_all_sourcing_config" ON sourcing_config;
  DROP POLICY IF EXISTS "service_all_sourcing_runs" ON sourcing_runs;
  DROP POLICY IF EXISTS "service_all_discovered_products" ON discovered_products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "service_all_sourcing_config" ON sourcing_config FOR ALL USING (true);
CREATE POLICY "service_all_sourcing_runs" ON sourcing_runs FOR ALL USING (true);
CREATE POLICY "service_all_discovered_products" ON discovered_products FOR ALL USING (true);
