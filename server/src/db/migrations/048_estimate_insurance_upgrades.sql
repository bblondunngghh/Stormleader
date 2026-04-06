-- ============================================================
-- ADD INSURANCE DETAILS AND UPGRADES TO ESTIMATES
-- Competitor gap: RoofLink insurance fields + SumoQuote upgrades
-- ============================================================

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS insurance_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS upgrades JSONB NOT NULL DEFAULT '[]'::jsonb;

-- insurance_details structure:
-- {
--   insurance_company, claim_number, date_of_loss,
--   acv, rcv, depreciation, deductible, overhead_profit, proceeds_received
-- }

-- upgrades structure (array):
-- [{ name, description, price, selected }]
