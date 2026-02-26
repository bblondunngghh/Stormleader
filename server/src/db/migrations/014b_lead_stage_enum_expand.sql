-- 014b_lead_stage_enum_expand.sql
-- Add new enum values to lead_stage (must run outside transaction)
-- @notransaction

ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'negotiating';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'in_production';
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'on_hold';
