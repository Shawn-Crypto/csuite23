-- Supabase Database Schema for Production
-- Complete Indian Investor Course Platform
-- Created: 2025-01-11

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create webhook_events table for tracking all payment webhooks
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Order Information
  order_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payment_id VARCHAR(255),
  
  -- Payment Details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_method VARCHAR(50),
  razorpay_payment_status VARCHAR(50),
  
  -- Customer Information
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),
  
  -- Product Information
  products JSONB,
  product_flags JSONB,
  
  -- Processing Information
  processed_at TIMESTAMP DEFAULT NOW(),
  processing_time_ms INTEGER,
  webhook_signature_valid BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  raw_webhook_data JSONB,
  notes JSONB,
  
  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create webhook_errors table for error tracking and debugging
CREATE TABLE IF NOT EXISTS webhook_errors (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Error Context
  order_id VARCHAR(255),
  event_type VARCHAR(100),
  endpoint VARCHAR(255),
  
  -- Error Details
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_code VARCHAR(100),
  
  -- Request Information
  webhook_data JSONB,
  request_headers JSONB,
  response_status INTEGER,
  
  -- Timing
  processing_time_ms INTEGER,
  retry_count INTEGER DEFAULT 0,
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create lead_captures table for tracking lead generation
CREATE TABLE IF NOT EXISTS lead_captures (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Lead Information
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  
  -- Source Tracking
  source_page VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer TEXT,
  
  -- Processing Status
  processed BOOLEAN DEFAULT FALSE,
  sent_to_zapier BOOLEAN DEFAULT FALSE,
  sent_to_meta_capi BOOLEAN DEFAULT FALSE,
  
  -- Lead Scoring (for future use)
  lead_score INTEGER DEFAULT 0,
  lead_quality VARCHAR(50) DEFAULT 'unknown',
  
  -- Conversion Tracking
  converted_to_purchase BOOLEAN DEFAULT FALSE,
  conversion_order_id VARCHAR(255),
  conversion_date TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create purchase_analytics table for business intelligence
CREATE TABLE IF NOT EXISTS purchase_analytics (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Purchase Information
  order_id VARCHAR(255) UNIQUE NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  
  -- Product Analysis
  products_purchased JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  product_categories JSONB,
  bundle_type VARCHAR(100),
  
  -- Customer Journey
  lead_capture_date TIMESTAMP,
  purchase_date TIMESTAMP NOT NULL,
  time_to_conversion_hours INTEGER,
  
  -- Attribution
  traffic_source VARCHAR(100),
  utm_data JSONB,
  first_touch_source VARCHAR(100),
  last_touch_source VARCHAR(100),
  
  -- Fulfillment Tracking
  course_access_granted BOOLEAN DEFAULT FALSE,
  database_delivered BOOLEAN DEFAULT FALSE,
  strategy_call_booked BOOLEAN DEFAULT FALSE,
  
  -- Revenue Attribution
  revenue_recognized DECIMAL(10,2),
  commission_paid DECIMAL(10,2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create meta_pixel_events table for tracking pixel events
CREATE TABLE IF NOT EXISTS meta_pixel_events (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  
  -- Event Information
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  event_source VARCHAR(50), -- 'client' or 'server'
  
  -- Customer Data
  customer_email VARCHAR(255),
  hashed_email VARCHAR(255),
  customer_phone VARCHAR(20),
  external_id VARCHAR(255),
  
  -- Event Data
  value DECIMAL(10,2),
  currency VARCHAR(3),
  content_ids JSONB,
  content_type VARCHAR(50),
  
  -- Deduplication
  deduplication_key VARCHAR(255),
  is_duplicate BOOLEAN DEFAULT FALSE,
  original_event_id INTEGER,
  
  -- Meta Response
  meta_response JSONB,
  events_received INTEGER DEFAULT 0,
  processing_success BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create system_health table for monitoring
CREATE TABLE IF NOT EXISTS system_health (
  id SERIAL PRIMARY KEY,
  
  -- Health Check Data
  check_time TIMESTAMP DEFAULT NOW(),
  endpoint VARCHAR(255) NOT NULL,
  response_time_ms INTEGER,
  status_code INTEGER,
  success BOOLEAN NOT NULL,
  
  -- Error Information
  error_message TEXT,
  error_details JSONB,
  
  -- System Metrics
  memory_usage_mb INTEGER,
  cpu_usage_percent DECIMAL(5,2),
  
  -- Service Status
  razorpay_status VARCHAR(50),
  meta_pixel_status VARCHAR(50),
  database_status VARCHAR(50),
  zapier_status VARCHAR(50)
);

-- Create indexes for performance

-- webhook_events indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_customer_email ON webhook_events(customer_email);
CREATE INDEX IF NOT EXISTS idx_webhook_events_amount ON webhook_events(amount);

-- webhook_errors indexes
CREATE INDEX IF NOT EXISTS idx_webhook_errors_created_at ON webhook_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_resolved ON webhook_errors(resolved);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_order_id ON webhook_errors(order_id);

-- lead_captures indexes
CREATE INDEX IF NOT EXISTS idx_lead_captures_email ON lead_captures(email);
CREATE INDEX IF NOT EXISTS idx_lead_captures_created_at ON lead_captures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_captures_processed ON lead_captures(processed);
CREATE INDEX IF NOT EXISTS idx_lead_captures_converted ON lead_captures(converted_to_purchase);

-- purchase_analytics indexes
CREATE INDEX IF NOT EXISTS idx_purchase_analytics_order_id ON purchase_analytics(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_analytics_customer_email ON purchase_analytics(customer_email);
CREATE INDEX IF NOT EXISTS idx_purchase_analytics_purchase_date ON purchase_analytics(purchase_date DESC);

-- meta_pixel_events indexes
CREATE INDEX IF NOT EXISTS idx_meta_pixel_events_event_id ON meta_pixel_events(event_id);
CREATE INDEX IF NOT EXISTS idx_meta_pixel_events_deduplication_key ON meta_pixel_events(deduplication_key);
CREATE INDEX IF NOT EXISTS idx_meta_pixel_events_created_at ON meta_pixel_events(created_at DESC);

-- system_health indexes
CREATE INDEX IF NOT EXISTS idx_system_health_check_time ON system_health(check_time DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_endpoint ON system_health(endpoint);
CREATE INDEX IF NOT EXISTS idx_system_health_success ON system_health(success);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_webhook_events_updated_at 
    BEFORE UPDATE ON webhook_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_captures_updated_at 
    BEFORE UPDATE ON lead_captures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_analytics_updated_at 
    BEFORE UPDATE ON purchase_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) setup
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_pixel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- Create service role policy (allows all operations for API)
CREATE POLICY "Allow service role all access on webhook_events" ON webhook_events
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all access on webhook_errors" ON webhook_errors
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all access on lead_captures" ON lead_captures
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all access on purchase_analytics" ON purchase_analytics
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all access on meta_pixel_events" ON meta_pixel_events
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all access on system_health" ON system_health
    FOR ALL USING (true) WITH CHECK (true);

-- Create useful views for analytics

-- Revenue summary view
CREATE OR REPLACE VIEW revenue_summary AS
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

-- Conversion funnel view
CREATE OR REPLACE VIEW conversion_funnel AS
SELECT 
    DATE_TRUNC('day', lc.created_at) as date,
    COUNT(lc.id) as leads,
    COUNT(CASE WHEN lc.converted_to_purchase THEN 1 END) as conversions,
    ROUND(
        COUNT(CASE WHEN lc.converted_to_purchase THEN 1 END) * 100.0 / COUNT(lc.id), 
        2
    ) as conversion_rate
FROM lead_captures lc
GROUP BY DATE_TRUNC('day', lc.created_at)
ORDER BY date DESC;

-- Product performance view
CREATE OR REPLACE VIEW product_performance AS
SELECT 
    jsonb_array_elements_text(products) as product,
    COUNT(*) as orders,
    SUM(amount) as revenue,
    AVG(amount) as avg_value
FROM webhook_events 
WHERE event_type = 'payment.captured' AND products IS NOT NULL
GROUP BY jsonb_array_elements_text(products)
ORDER BY revenue DESC;

-- Insert initial system health check
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
    'schema_created'
);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Tables created: webhook_events, webhook_errors, lead_captures, purchase_analytics, meta_pixel_events, system_health';
    RAISE NOTICE 'Indexes created for performance optimization';
    RAISE NOTICE 'Views created: revenue_summary, conversion_funnel, product_performance';
    RAISE NOTICE 'Row Level Security enabled for all tables';
END $$;