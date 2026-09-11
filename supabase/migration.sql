-- ============================================================
-- Victoriosa Autopilot — Supabase Migration
-- Idempotent | No destructive | RLS enabled | UUID PKs
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. FUNCTION: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. FUNCTION: is_admin() — SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- ============================================================
-- 3. FUNCTION: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- ============================================================
-- 4. TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin', 'operator')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'customer');

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE,
  subtitle VARCHAR(255),
  description TEXT,
  original_title VARCHAR(255),
  category VARCHAR(100),
  sub_category VARCHAR(100),
  brand VARCHAR(100) DEFAULT 'Victoriosa',
  sku VARCHAR(100) UNIQUE,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  cost_price DECIMAL(10,2) CHECK (cost_price IS NULL OR cost_price >= 0),
  inventory INTEGER DEFAULT 0 CHECK (inventory >= 0),
  rating DECIMAL(3,1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
  status VARCHAR(50) DEFAULT 'discovered'
    CHECK (status IN ('discovered','analyzing','validated','ready_for_review','approved','draft_ready','published','rejected')),
  rejection_reason TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  badges JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  specs JSONB DEFAULT '{}'::jsonb,
  images TEXT[] DEFAULT '{}',
  original_images TEXT[] DEFAULT '{}',
  image_enhancements JSONB DEFAULT '[]'::jsonb,
  is_image_enhanced BOOLEAN DEFAULT false,
  variants JSONB DEFAULT '[]'::jsonb,
  supplier_id UUID,
  traceability JSONB DEFAULT '{}'::jsonb,
  created_by VARCHAR(100) DEFAULT 'Victoriosa Autopilot Core',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can only read published products
CREATE POLICY "Public read published products"
  ON products FOR SELECT
  USING (status = 'published');

-- Admins can do everything
CREATE POLICY "Admins full access products"
  ON products FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. TABLE: suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) UNIQUE NOT NULL,
  supplier_type VARCHAR(50) DEFAULT 'direct_wholesaler'
    CHECK (supplier_type IN ('manufacturer','authorized_distributor','artisan_workshop','direct_wholesaler')),
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active','under_review','inactive','evaluating','restricted')),
  stock_availability VARCHAR(50) DEFAULT 'in_stock'
    CHECK (stock_availability IN ('in_stock','on_demand','limited','backorder')),
  contact JSONB DEFAULT '{}'::jsonb,
  catalogs JSONB DEFAULT '{}'::jsonb,
  pricing_agreements JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access suppliers"
  ON suppliers FOR ALL
  USING (is_admin());

-- No public read for suppliers (private B2B data)

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email VARCHAR(255),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_address TEXT,
  customer_city VARCHAR(100),
  customer_postal_code VARCHAR(20),
  customer_country VARCHAR(100),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) DEFAULT 0 CHECK (subtotal >= 0),
  shipping_cost DECIMAL(10,2) DEFAULT 0 CHECK (shipping_cost >= 0),
  discount DECIMAL(10,2) DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(10,2) DEFAULT 0 CHECK (total >= 0),
  currency VARCHAR(10) DEFAULT 'USD',
  payment_method VARCHAR(50) DEFAULT 'paypal',
  payment_status VARCHAR(50) DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','cancelled','expired')),
  payment_id VARCHAR(255),
  payment_gateway VARCHAR(50) DEFAULT 'paypal',
  status VARCHAR(50) DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','confirmed','preparing','shipped','delivered','cancelled','refunded')),
  tracking_number VARCHAR(255),
  estimated_delivery VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can read their own orders
CREATE POLICY "Users read own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert orders (with their own user_id)
CREATE POLICY "Users insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins full access
CREATE POLICY "Admins full access orders"
  ON orders FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. TABLE: supplier_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  product_title VARCHAR(255),
  product_sku VARCHAR(100),
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  selected_variant VARCHAR(255),
  source_platform VARCHAR(100),
  source_url TEXT,
  source_sku VARCHAR(100),
  supplier_name VARCHAR(255),
  unit_cost_eur DECIMAL(10,2) CHECK (unit_cost_eur IS NULL OR unit_cost_eur >= 0),
  shipping_cost_eur DECIMAL(10,2) CHECK (shipping_cost_eur IS NULL OR shipping_cost_eur >= 0),
  total_cost_eur DECIMAL(10,2) CHECK (total_cost_eur IS NULL OR total_cost_eur >= 0),
  sale_price_eur DECIMAL(10,2) CHECK (sale_price_eur IS NULL OR sale_price_eur >= 0),
  total_revenue_eur DECIMAL(10,2) CHECK (total_revenue_eur IS NULL OR total_revenue_eur >= 0),
  estimated_margin_pct DECIMAL(5,2) CHECK (estimated_margin_pct IS NULL OR (estimated_margin_pct >= -100 AND estimated_margin_pct <= 500)),
  status VARCHAR(50) DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','verification_passed','verification_failed','human_action_required','ready_to_order','order_placed','shipped','delivered','cancelled','refunded')),
  supplier_order_reference VARCHAR(255),
  tracking_number VARCHAR(255),
  carrier VARCHAR(100),
  tracking_url TEXT,
  human_action_reason TEXT,
  manual_purchase_notes TEXT,
  verification JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

-- No public read for supplier orders (private B2B data)
CREATE POLICY "Admins full access supplier_orders"
  ON supplier_orders FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_supplier_orders_order_id ON supplier_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_product_id ON supplier_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_id ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_created_at ON supplier_orders(created_at DESC);

CREATE TRIGGER update_supplier_orders_updated_at
  BEFORE UPDATE ON supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. TABLE: autopilot_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS autopilot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number SERIAL UNIQUE,
  status VARCHAR(50) DEFAULT 'running'
    CHECK (status IN ('running','completed','failed','cancelled')),
  trigger_type VARCHAR(50) DEFAULT 'manual'
    CHECK (trigger_type IN ('manual','scheduled','batch_scan','single_pipeline')),
  category VARCHAR(100),
  items_found INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_approved INTEGER DEFAULT 0,
  items_published INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,
  duration_seconds DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE autopilot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access autopilot_runs"
  ON autopilot_runs FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_autopilot_runs_status ON autopilot_runs(status);
CREATE INDEX IF NOT EXISTS idx_autopilot_runs_created_at ON autopilot_runs(created_at DESC);

CREATE TRIGGER update_autopilot_runs_updated_at
  BEFORE UPDATE ON autopilot_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. TABLE: autopilot_run_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS autopilot_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES autopilot_runs(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'info'
    CHECK (level IN ('info','warn','error','success')),
  message TEXT NOT NULL,
  product_id UUID,
  stage VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE autopilot_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access run_logs"
  ON autopilot_run_logs FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_run_logs_run_id ON autopilot_run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_created_at ON autopilot_run_logs(created_at DESC);

-- ============================================================
-- 11. TABLE: product_analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS product_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  demand_score INTEGER CHECK (demand_score IS NULL OR (demand_score >= 0 AND demand_score <= 100)),
  competition_level VARCHAR(20) CHECK (competition_level IS NULL OR competition_level IN ('low','medium','high')),
  margin_potential INTEGER CHECK (margin_potential IS NULL OR (margin_potential >= 0 AND margin_potential <= 100)),
  brand_fit_score INTEGER CHECK (brand_fit_score IS NULL OR (brand_fit_score >= 0 AND brand_fit_score <= 100)),
  brand_fit_justification TEXT,
  quality_score INTEGER CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  logistics_score INTEGER CHECK (logistics_score IS NULL OR (logistics_score >= 0 AND logistics_score <= 100)),
  overall_score INTEGER CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
  score_tier VARCHAR(5) CHECK (score_tier IS NULL OR score_tier IN ('S','A','B','C','D')),
  target_audience TEXT,
  key_selling_points JSONB DEFAULT '[]'::jsonb,
  validated_claims JSONB DEFAULT '[]'::jsonb,
  potential_issues JSONB DEFAULT '[]'::jsonb,
  risk_level VARCHAR(20) DEFAULT 'low'
    CHECK (risk_level IN ('low','medium','high','critical')),
  copyright_risk VARCHAR(20) DEFAULT 'none'
    CHECK (copyright_risk IN ('none','low','medium','high')),
  claims_risk VARCHAR(30) DEFAULT 'safe'
    CHECK (claims_risk IN ('safe','needs_disclaimer','prohibited')),
  supplier_risk VARCHAR(20) DEFAULT 'safe'
    CHECK (supplier_risk IN ('safe','moderate','unverified')),
  return_risk VARCHAR(20) DEFAULT 'low'
    CHECK (return_risk IN ('low','medium','high')),
  risk_details JSONB DEFAULT '[]'::jsonb,
  analysis_by VARCHAR(100) DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_analysis ENABLE ROW LEVEL SECURITY;

-- Public can read analysis for published products only
CREATE POLICY "Public read analysis for published products"
  ON product_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_analysis.product_id
        AND products.status = 'published'
    )
  );

CREATE POLICY "Admins full access product_analysis"
  ON product_analysis FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_product_analysis_product_id ON product_analysis(product_id);
CREATE INDEX IF NOT EXISTS idx_product_analysis_overall_score ON product_analysis(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_analysis_risk_level ON product_analysis(risk_level);

CREATE TRIGGER update_product_analysis_updated_at
  BEFORE UPDATE ON product_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins read audit_logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

-- Only backend (service_role) can insert audit logs
-- This is enforced by using service_role key on backend inserts

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 13. TABLE: alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  title VARCHAR(255),
  message TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE SET NULL,
  source_platform VARCHAR(100),
  action_link TEXT,
  resolved BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access alerts"
  ON alerts FOR ALL
  USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- ============================================================
-- 14. TABLE: settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public can read settings (needed for store config)
CREATE POLICY "Public read settings"
  ON settings FOR SELECT
  USING (true);

CREATE POLICY "Admins full access settings"
  ON settings FOR ALL
  USING (is_admin());

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 15. TABLE: feature_flags
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(255) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public can read feature flags (frontend needs them)
CREATE POLICY "Public read feature_flags"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Admins full access feature_flags"
  ON feature_flags FOR ALL
  USING (is_admin());

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 16. VIEWS
-- ============================================================

-- Published products only (public safe)
CREATE OR REPLACE VIEW published_products AS
SELECT
  p.id,
  p.title,
  p.slug,
  p.subtitle,
  p.category,
  p.sub_category,
  p.brand,
  p.price,
  p.compare_at_price,
  p.images,
  p.rating,
  p.review_count,
  p.tags,
  p.badges,
  p.features,
  p.specs,
  p.inventory,
  pa.overall_score,
  pa.score_tier,
  pa.demand_score,
  pa.risk_level
FROM products p
LEFT JOIN product_analysis pa ON pa.product_id = p.id
WHERE p.status = 'published';

-- Recent orders for admin dashboard
CREATE OR REPLACE VIEW recent_orders AS
SELECT
  o.id,
  o.order_number,
  o.customer_name,
  o.customer_email,
  o.total,
  o.currency,
  o.payment_status,
  o.status,
  o.tracking_number,
  o.created_at
FROM orders o
ORDER BY o.created_at DESC
LIMIT 100;

-- Autopilot stats (last 30 days)
CREATE OR REPLACE VIEW autopilot_stats AS
SELECT
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  COALESCE(SUM(items_found), 0) AS total_items_found,
  COALESCE(SUM(items_approved), 0) AS total_items_approved,
  COALESCE(SUM(items_published), 0) AS total_items_published,
  COALESCE(SUM(items_rejected), 0) AS total_items_rejected,
  COALESCE(AVG(duration_seconds), 0) AS avg_duration_seconds
FROM autopilot_runs
WHERE created_at >= now() - INTERVAL '30 days';

-- ============================================================
-- 17. STORAGE BUCKET: product-images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for product images
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Admin upload only
CREATE POLICY "Admin upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND is_admin()
  );

-- Admin update only
CREATE POLICY "Admin update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND is_admin()
  );

-- Admin delete only
CREATE POLICY "Admin delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND is_admin()
  );

-- ============================================================
-- 18. SEED: Settings (only if not exists)
-- ============================================================
INSERT INTO settings (key, value, description)
VALUES
  ('store_name', '"Victoriosa"'::jsonb, 'Nombre de la tienda'),
  ('min_margin_pct', '50'::jsonb, 'Margen mínimo porcentaje para publicar'),
  ('auto_publish_enabled', 'false'::jsonb, 'Publicar automáticamente productos aprobados'),
  ('gemini_model', '"gemini-2.5-flash"'::jsonb, 'Modelo de IA para análisis'),
  ('auto_approve_score_threshold', '85'::jsonb, 'Score mínimo para auto-aprobación'),
  ('max_risk_level_allowed', '"medium"'::jsonb, 'Nivel de riesgo máximo permitido'),
  ('default_currency', '"EUR"'::jsonb, 'Moneda por defecto'),
  ('exchange_rate_eur_usd', '1.08'::jsonb, 'Tasa de cambio EUR/USD')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 19. SEED: Feature Flags (only if not exists)
-- ============================================================
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES
  ('autopilot_discovery', true, 'Habilitar descubrimiento de productos por IA'),
  ('autopilot_analysis', true, 'Habilitar análisis de pipeline por IA'),
  ('auto_image_enhancement', false, 'Mejora automática de imágenes'),
  ('supplier_auto_order', false, 'Órdenes automáticas a proveedores')
ON CONFLICT (flag_name) DO NOTHING;

-- ============================================================
-- 20. SEED: Demo Suppliers (only if table is empty)
-- ============================================================
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM suppliers) = 0 THEN
    INSERT INTO suppliers (id, name, code, supplier_type, status, stock_availability, contact, catalogs, pricing_agreements, metrics, notes)
    VALUES
    (
      'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
      'Acoustix Precision GmbH',
      'SUP-ACX-001',
      'authorized_distributor',
      'active',
      'in_stock',
      '{"representative": "Klaus Lindner", "email": "klindner@acoustix-precision.de", "phone": "+49 89 2314 9901", "address": "Industriestraße 45", "city": "Múnich", "country": "Alemania", "website": "https://acoustix-precision.de", "warehouseLocations": ["Múnich (Alemania)", "Valencia Hub (España)", "Róterdam (Países Bajos)"]}'::jsonb,
      '{"categories": ["Tecnología & Gadgets", "Audio Hi-Fi", "Accesorios Tech"], "brandNames": ["Acoustix Lab", "SoundVibe Pro", "TitanSonics"], "totalSkus": 84, "catalogUrl": "https://catalog.acoustix-precision.de/v3/victoriosa"}'::jsonb,
      '{"currency": "EUR", "paymentTerms": "net_30", "moq": 5, "leadTimeDaysMin": 1, "leadTimeDaysMax": 3, "baseDiscountPct": 15, "volumeTiers": [{"minUnits": 10, "discountPct": 18}, {"minUnits": 50, "discountPct": 24}, {"minUnits": 150, "discountPct": 30}], "avgShippingPerUnit": 3.50, "returnAgreement": "Garantía 30 días cambio directo sin coste."}'::jsonb,
      '{"reliabilityScore": 96, "fulfillmentRate": 99.2, "defectRate": 0.3, "avgDispatchDays": 1.2, "auditStatus": "certified_iso9001", "totalOrdersPlaced": 142}'::jsonb,
      'Proveedor homologado de referencia para electrónica de audio.'
    ),
    (
      'a1b2c3d4-e5f6-7890-abcd-ef1234567802',
      'Lumina Nordics Studio ApS',
      'SUP-LUM-002',
      'manufacturer',
      'active',
      'in_stock',
      '{"representative": "Erik Svensson", "email": "esvensson@lumina-nordics.dk", "phone": "+45 32 96 00 11", "address": "Nordre Fasanvej 120", "city": "Copenhague", "country": "Dinamarca", "website": "https://lumina-nordics.dk", "warehouseLocations": ["Copenhague (Dinamarca)", "Malmö (Suecia)"]}'::jsonb,
      '{"categories": ["Hogar & Diseño", "Iluminación", "Decoración Nórdica"], "brandNames": ["Lumina Studio", "NordGlow", "FjordLight"], "totalSkus": 67, "catalogUrl": "https://catalog.lumina-nordics.dk/victoriosa"}'::jsonb,
      '{"currency": "EUR", "paymentTerms": "net_45", "moq": 3, "leadTimeDaysMin": 2, "leadTimeDaysMax": 5, "baseDiscountPct": 12, "volumeTiers": [{"minUnits": 10, "discountPct": 16}, {"minUnits": 50, "discountPct": 22}], "avgShippingPerUnit": 4.20, "returnAgreement": "Devolución 45 días. Producto defectuoso: reemplazo inmediato."}'::jsonb,
      '{"reliabilityScore": 94, "fulfillmentRate": 98.5, "defectRate": 0.4, "avgDispatchDays": 1.8, "auditStatus": "verified", "totalOrdersPlaced": 89}'::jsonb,
      'Fabricante danés de iluminación y diseño nórdico. Estudio propio de diseño.'
    ),
    (
      'a1b2c3d4-e5f6-7890-abcd-ef1234567803',
      'Victoriosa B2B Hub',
      'SUP-VIC-003',
      'direct_wholesaler',
      'active',
      'in_stock',
      '{"representative": "Área Comercial", "email": "b2b@victoriosa.com", "phone": "+34 91 123 4567", "address": "Calle Gran Vía 42, Oficina 301", "city": "Madrid", "country": "España", "website": "https://victoriosa.com/b2b", "warehouseLocations": ["Madrid (España)", "Barcelona (España)"]}'::jsonb,
      '{"categories": ["Tecnología & Gadgets", "Hogar & Diseño", "Moda & Accesorios", "Belleza & Bienestar"], "brandNames": ["Victoriosa"], "totalSkus": 150, "catalogUrl": "https://b2b.victoriosa.com/catalog"}'::jsonb,
      '{"currency": "EUR", "paymentTerms": "net_15", "moq": 1, "leadTimeDaysMin": 1, "leadTimeDaysMax": 2, "baseDiscountPct": 20, "volumeTiers": [{"minUnits": 10, "discountPct": 25}, {"minUnits": 50, "discountPct": 32}], "avgShippingPerUnit": 2.80, "returnAgreement": "30 días sin coste con recogida a domicilio."}'::jsonb,
      '{"reliabilityScore": 98, "fulfillmentRate": 99.8, "defectRate": 0.1, "avgDispatchDays": 0.8, "auditStatus": "certified_iso9001", "totalOrdersPlaced": 312}'::jsonb,
      'Hub central de Victoriosa. Fulfillment propio y logística express España/UE.'
    );
  END IF;
END $$;
