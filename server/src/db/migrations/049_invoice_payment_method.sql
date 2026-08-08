-- 049_invoice_payment_method.sql
-- The Record Payment modal collects a payment method and a reference/check number,
-- and the success toast claims both were recorded, but there was nowhere to store
-- them: recordPayment only ever updated amount_paid. Both values were discarded.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;
