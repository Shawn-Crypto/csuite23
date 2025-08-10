-- Database Schema for Razorpay Integration System
-- Guide 1 & 8 Implementation: Complete data persistence layer
-- Compatible with Supabase PostgreSQL

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Webhook events table for comprehensive event logging
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  payment_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'INR',
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_name VARCHAR(255),
  products JSONB,
  status VARCHAR(50),
  processed BOOLEAN DEFAULT FALSE,
  processing_time_ms INTEGER,
  signature_verified BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead captures table for comprehensive lead management
CREATE TABLE IF NOT EXISTS lead_captures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  source VARCHAR(100) DEFAULT 'website',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),
  utm_term VARCHAR(100),
  user_agent TEXT,
  ip_address INET,
  country VARCHAR(2),
  lead_score INTEGER DEFAULT 0,
  zapier_sent BOOLEAN DEFAULT FALSE,
  zapier_sent_at TIMESTAMP WITH TIME ZONE,
  meta_sent BOOLEAN DEFAULT FALSE,
  meta_sent_at TIMESTAMP WITH TIME ZONE,
  conversion_tracked BOOLEAN DEFAULT FALSE,
  conversion_tracked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table for comprehensive payment tracking
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razorpay_payment_id VARCHAR(255) UNIQUE,
  razorpay_order_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(50) NOT NULL,
  method VARCHAR(50),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_name VARCHAR(255),
  billing_address JSONB,
  product_details JSONB,
  gateway_response JSONB,
  webhook_event_id UUID REFERENCES webhook_events(id),
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refunded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External API logs table for integration monitoring
CREATE TABLE IF NOT EXISTS external_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  webhook_event_id UUID REFERENCES webhook_events(id),
  lead_capture_id UUID REFERENCES lead_captures(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health logs table for monitoring
CREATE TABLE IF NOT EXISTS system_health_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  details JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_lead_captures_email ON lead_captures(email);
CREATE INDEX IF NOT EXISTS idx_lead_captures_created_at ON lead_captures(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_captures_source ON lead_captures(source);
CREATE INDEX IF NOT EXISTS idx_lead_captures_zapier_sent ON lead_captures(zapier_sent);
CREATE INDEX IF NOT EXISTS idx_lead_captures_meta_sent ON lead_captures(meta_sent);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_external_api_logs_service ON external_api_logs(service);
CREATE INDEX IF NOT EXISTS idx_external_api_logs_created_at ON external_api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_external_api_logs_success ON external_api_logs(success);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_check_type ON system_health_logs(check_type);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_created_at ON system_health_logs(created_at);

-- Row Level Security policies for data protection
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_logs ENABLE ROW LEVEL SECURITY;

-- Service role policy (for API access)
DROP POLICY IF EXISTS "Service role can manage all data" ON webhook_events;
CREATE POLICY "Service role can manage all data" ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all data" ON lead_captures;
CREATE POLICY "Service role can manage all data" ON lead_captures
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all data" ON payment_transactions;
CREATE POLICY "Service role can manage all data" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all data" ON external_api_logs;
CREATE POLICY "Service role can manage all data" ON external_api_logs
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage all data" ON system_health_logs;
CREATE POLICY "Service role can manage all data" ON system_health_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_captures_updated_at ON lead_captures;
CREATE TRIGGER update_lead_captures_updated_at
  BEFORE UPDATE ON lead_captures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'captured') as successful_payments,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
  SUM(amount) FILTER (WHERE status = 'captured') as total_revenue,
  AVG(amount) FILTER (WHERE status = 'captured') as avg_order_value
FROM payment_transactions
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW lead_conversion_funnel AS
SELECT 
  DATE_TRUNC('day', lc.created_at) as date,
  COUNT(lc.id) as total_leads,
  COUNT(pt.id) as converted_payments,
  ROUND(
    (COUNT(pt.id)::DECIMAL / NULLIF(COUNT(lc.id), 0)) * 100, 2
  ) as conversion_rate
FROM lead_captures lc
LEFT JOIN payment_transactions pt ON lc.email = pt.customer_email 
  AND pt.created_at >= lc.created_at
  AND pt.created_at <= lc.created_at + INTERVAL '24 hours'
GROUP BY DATE_TRUNC('day', lc.created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW webhook_performance AS
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE processed = true) as processed_events,
  COUNT(*) FILTER (WHERE signature_verified = true) as verified_events,
  AVG(processing_time_ms) as avg_processing_time,
  MAX(processing_time_ms) as max_processing_time,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count
FROM webhook_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY total_events DESC;

-- Cleanup function for old logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Clean up old external API logs
  DELETE FROM external_api_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Clean up old system health logs
  DELETE FROM system_health_logs 
  WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- Keep webhook events longer but clean up very old ones
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '1 day' * (retention_days * 2)
    AND processed = true;
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE webhook_events IS 'Comprehensive logging of all Razorpay webhook events with processing status';
COMMENT ON TABLE lead_captures IS 'Lead capture data with UTM tracking and conversion status';
COMMENT ON TABLE payment_transactions IS 'Complete payment transaction records with customer details';
COMMENT ON TABLE external_api_logs IS 'Logs for all external API calls (Zapier Meta CAPI etc)';
COMMENT ON TABLE system_health_logs IS 'System health check results for monitoring';
COMMENT ON VIEW payment_summary IS 'Daily payment statistics and revenue metrics';
COMMENT ON VIEW lead_conversion_funnel IS 'Lead to payment conversion tracking';
COMMENT ON VIEW webhook_performance IS 'Webhook processing performance metrics';
COMMENT ON FUNCTION cleanup_old_logs IS 'Automated cleanup of old log entries for maintenance';