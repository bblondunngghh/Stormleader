-- Alert configuration per tenant
CREATE TABLE alert_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  -- Notification channels
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  -- Recipients (array of emails/phones beyond just the admin)
  email_recipients TEXT[] DEFAULT '{}',
  sms_recipients TEXT[] DEFAULT '{}',
  -- Thresholds — only alert if storm meets these minimums
  min_hail_size_in NUMERIC(4,2) DEFAULT 1.00,
  min_wind_speed_mph NUMERIC(5,1) DEFAULT 58.0,
  -- How often to send digests vs immediate alerts
  alert_mode VARCHAR(20) DEFAULT 'immediate', -- 'immediate' or 'digest'
  digest_hour INT DEFAULT 7, -- Hour (UTC) to send daily digest
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Log of sent alerts (dedup + audit trail)
CREATE TABLE storm_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storm_event_id UUID NOT NULL REFERENCES storm_events(id) ON DELETE CASCADE,
  alert_type VARCHAR(20) NOT NULL, -- 'email', 'sms'
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  affected_properties INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, storm_event_id, alert_type, recipient)
);

CREATE INDEX idx_storm_alerts_tenant ON storm_alerts(tenant_id);
CREATE INDEX idx_storm_alerts_storm ON storm_alerts(storm_event_id);
CREATE INDEX idx_storm_alerts_sent_at ON storm_alerts(sent_at DESC);
