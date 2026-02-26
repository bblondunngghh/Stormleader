-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TYPE notification_type AS ENUM (
  'lead_assigned',
  'lead_status_changed',
  'task_due_soon',
  'task_overdue',
  'estimate_viewed',
  'estimate_accepted',
  'estimate_declined',
  'storm_alert',
  'new_storm_leads',
  'mention'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  reference_type VARCHAR(50),  -- 'lead', 'task', 'estimate', 'storm_event'
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);

-- ============================================================
-- NOTIFICATION PREFERENCES (per user, per type)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  push BOOLEAN NOT NULL DEFAULT false,
  email_digest VARCHAR(20) NOT NULL DEFAULT 'immediate'
    CHECK (email_digest IN ('immediate', 'hourly', 'daily', 'off')),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- Seed default preferences for all existing users
INSERT INTO notification_preferences (user_id, notification_type, in_app, email, push, email_digest)
SELECT u.id, t.type, true, true, false, 'immediate'
FROM users u
CROSS JOIN (VALUES
  ('lead_assigned'::notification_type),
  ('lead_status_changed'::notification_type),
  ('task_due_soon'::notification_type),
  ('task_overdue'::notification_type),
  ('estimate_viewed'::notification_type),
  ('estimate_accepted'::notification_type),
  ('estimate_declined'::notification_type),
  ('storm_alert'::notification_type),
  ('new_storm_leads'::notification_type),
  ('mention'::notification_type)
) AS t(type)
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUTOMATIONS (from CRMLead spec)
-- ============================================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,  -- 'lead_created', 'stage_changed', 'task_overdue', etc.
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL,   -- 'send_email', 'send_sms', 'assign_rep', 'create_task', 'change_stage', 'notify'
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automations_tenant ON automations(tenant_id, is_active);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) DEFAULT 'other',  -- 'photo', 'contract', 'insurance', 'inspection', 'other'
  filename VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,    -- local path or S3 URL
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  description TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_lead ON documents(lead_id);
