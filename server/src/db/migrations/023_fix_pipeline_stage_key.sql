-- 023_fix_pipeline_stage_key.sql
-- Fix mismatched pipeline stage key: 'new_lead' should be 'new' to match lead_stage enum

UPDATE pipeline_stages SET key = 'new' WHERE key = 'new_lead';
