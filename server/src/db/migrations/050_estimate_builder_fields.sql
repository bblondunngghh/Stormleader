-- ============================================================
-- PERSIST THE ESTIMATE BUILDER'S REMAINING FIELDS
--
-- EstimatesView's builder has full UI for all nine of these, sends every one of
-- them in its Save Draft / Save & Send / autosave payloads, AND hydrates eight of
-- them back off the estimate on open (EstimatesView.jsx:1324-1367). None of them
-- had a column, so estimateService.updateEstimate's allowedFields dropped them
-- and every save returned 200 with nothing written. Reopening the estimate reset
-- the controls to their defaults.
--
-- Same shape as 048, which added insurance_details/upgrades for the panels that
-- sit directly beside these in the same builder.
-- ============================================================

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS estimate_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS estimate_date    DATE,
  ADD COLUMN IF NOT EXISTS introduction     TEXT,
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
  ADD COLUMN IF NOT EXISTS footer_notes     TEXT,
  ADD COLUMN IF NOT EXISTS profit_margin    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS discounts        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit          JSONB;

-- discounts structure (array): [{ name, type: 'flat'|'percent', value }]
-- signers structure (array):   [{ first_name, last_name, email, isPrimary }]
-- deposit structure (object):  { amount, description, type: 'flat'|'percent' } | NULL when disabled
--
-- profit_margin is deliberately left NULL-able with no default: the builder falls
-- back to its own 30% default when the column is null (EstimatesView.jsx:1351-1353),
-- so existing estimates keep rendering exactly as they do today.
