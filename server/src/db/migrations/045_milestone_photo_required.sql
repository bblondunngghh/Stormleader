-- Add photo_required flag to work order milestones (RoofLink-style quality control)
ALTER TABLE work_order_milestones ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false;
