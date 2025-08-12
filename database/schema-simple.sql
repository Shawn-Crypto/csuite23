-- Simplified Database Schema - No Conflicts
-- Complete Indian Investor Course Platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS webhook_errors CASCADE;
DROP TABLE IF EXISTS lead_captures CASCADE;
DROP TABLE IF EXISTS purchase_analytics CASCADE;
DROP TABLE IF EXISTS meta_pixel_events CASCADE;
DROP TABLE IF EXISTS system_health CASCADE;

-- Drop existing views if they exist
DROP VIEW IF EXISTS revenue_summary CASCADE;
DROP VIEW IF EXISTS conversion_funnel CASCADE;
DROP VIEW IF EXISTS product_performance CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Create webhook_events table
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_method VARCHAR(50),
  razorpay_payment_status VARCHAR(50),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),
  products JSONB,
  product_flags JSONB,
  processed_at TIMESTAMP DEFAULT NOW(),
  processing_time_ms INTEGER,
  webhook_signature_valid BOOLEAN DEFAULT TRUE,
  raw_webhook_data JSONB,
  notes JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create webhook_errors table
CREATE TABLE webhook_errors (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  order_id VARCHAR(255),
  event_type VARCHAR(100),
  endpoint VARCHAR(255),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code VARCHAR(100),
  webhook_data JSONB,
  request_headers JSONB,
  response_status INTEGER,
  processing_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create lead_captures table
CREATE TABLE lead_captures (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  source_page VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer TEXT,
  is_processed BOOLEAN DEFAULT FALSE,
  sent_to_zapier BOOLEAN DEFAULT FALSE,
  sent_to_meta_capi BOOLEAN DEFAULT FALSE,
  lead_score INTEGER DEFAULT 0,
  lead_quality VARCHAR(50) DEFAULT 'unknown',
  converted_to_purchase BOOLEAN DEFAULT FALSE,
  conversion_order_id VARCHAR(255),
  conversion_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create purchase_analytics table
CREATE TABLE purchase_analytics (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  products_purchased JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  product_categories JSONB,
  bundle_type VARCHAR(100),
  lead_capture_date TIMESTAMP,
  purchase_date TIMESTAMP NOT NULL,
  time_to_conversion_hours INTEGER,
  traffic_source VARCHAR(100),
  utm_data JSONB,
  first_touch_source VARCHAR(100),
  last_touch_source VARCHAR(100),
  course_access_granted BOOLEAN DEFAULT FALSE,
  database_delivered BOOLEAN DEFAULT FALSE,
  strategy_call_booked BOOLEAN DEFAULT FALSE,
  revenue_recognized DECIMAL(10,2),
  commission_paid DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create meta_pixel_events table
CREATE TABLE meta_pixel_events (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_source VARCHAR(50),
  customer_email VARCHAR(255),
  hashed_email VARCHAR(255),
  customer_phone VARCHAR(20),
  external_id VARCHAR(255),
  value DECIMAL(10,2),
  currency VARCHAR(3),
  content_ids JSONB,
  content_type VARCHAR(50),
  deduplication_key VARCHAR(255),
  is_duplicate BOOLEAN DEFAULT FALSE,
  original_event_id INTEGER,
  meta_response JSONB,
  events_received INTEGER DEFAULT 0,
  processing_success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create system_health table
CREATE TABLE system_health (
  id SERIAL PRIMARY KEY,
  check_time TIMESTAMP DEFAULT NOW(),
  endpoint VARCHAR(255) NOT NULL,
  response_time_ms INTEGER,
  status_code INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  error_details JSONB,
  memory_usage_mb INTEGER,
  cpu_usage_percent DECIMAL(5,2),
  razorpay_status VARCHAR(50),
  meta_pixel_status VARCHAR(50),
  database_status VARCHAR(50),
  zapier_status VARCHAR(50)
);

-- Create essential indexes for performance
CREATE INDEX idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

CREATE INDEX idx_webhook_errors_created_at ON webhook_errors(created_at DESC);
CREATE INDEX idx_webhook_errors_resolved ON webhook_errors(resolved);

CREATE INDEX idx_lead_captures_email ON lead_captures(email);
CREATE INDEX idx_lead_captures_created_at ON lead_captures(created_at DESC);
CREATE INDEX idx_lead_captures_is_processed ON lead_captures(is_processed);

CREATE INDEX idx_purchase_analytics_order_id ON purchase_analytics(order_id);
CREATE INDEX idx_purchase_analytics_purchase_date ON purchase_analytics(purchase_date DESC);

CREATE INDEX idx_meta_pixel_events_event_id ON meta_pixel_events(event_id);
CREATE INDEX idx_meta_pixel_events_created_at ON meta_pixel_events(created_at DESC);

CREATE INDEX idx_system_health_check_time ON system_health(check_time DESC);

-- Create update trigger function with fixed search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SET search_path = pg_catalog, public
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_webhook_events_updated_at 
    BEFORE UPDATE ON webhook_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_captures_updated_at 
    BEFORE UPDATE ON lead_captures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_analytics_updated_at 
    BEFORE UPDATE ON purchase_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_pixel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Allow service role access" ON webhook_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON webhook_errors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON lead_captures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON purchase_analytics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON meta_pixel_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON system_health FOR ALL USING (true) WITH CHECK (true);

-- Create simple analytics views
CREATE VIEW revenue_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_orders,
    SUM(amount) as total_revenue,
    AVG(amount) as avg_order_value,
    COUNT(DISTINCT customer_email) as unique_customers
FROM webhook_events 
WHERE event_type = 'payment.captured'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE VIEW conversion_funnel AS
SELECT 
    DATE_TRUNC('day', lc.created_at) as date,
    COUNT(lc.id) as leads,
    COUNT(CASE WHEN lc.converted_to_purchase THEN 1 END) as conversions,
    ROUND(
        COUNT(CASE WHEN lc.converted_to_purchase THEN 1 END) * 100.0 / NULLIF(COUNT(lc.id), 0), 
        2
    ) as conversion_rate
FROM lead_captures lc
GROUP BY DATE_TRUNC('day', lc.created_at)
ORDER BY date DESC;

-- Insert initial health check
INSERT INTO system_health (
    endpoint, 
    response_time_ms, 
    status_code, 
    success,
    razorpay_status,
    meta_pixel_status,
    database_status
) VALUES (
    '/api/health-check',
    0,
    200,
    true,
    'initialized',
    'initialized', 
    'schema_deployed'
);

-- Success notification
SELECT 'Database schema deployed successfully! Tables created: webhook_events, webhook_errors, lead_captures, purchase_analytics, meta_pixel_events, system_health' as message;