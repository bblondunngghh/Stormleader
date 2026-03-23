-- 037_contracts_expenses_milestones.sql
-- Contracts, expenses, work order milestones, and client status tokens

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id),
  template_type VARCHAR(50) DEFAULT 'standard',
  status VARCHAR(20) DEFAULT 'draft',
  content JSONB DEFAULT '{}',
  signer_name VARCHAR(255),
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  token VARCHAR(64) UNIQUE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_lead ON contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contracts_token ON contracts(token);

-- Contract templates
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_lead ON expenses(lead_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- Work order milestones
CREATE TABLE IF NOT EXISTS work_order_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_milestones_wo ON work_order_milestones(work_order_id);

-- Client status tokens
CREATE TABLE IF NOT EXISTS client_status_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  token VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_tokens_token ON client_status_tokens(token);

-- Seed built-in contract templates
INSERT INTO contract_templates (tenant_id, name, type, content, is_default)
SELECT NULL, 'Standard Roofing Contract', 'standard', '{
  "sections": [
    {
      "title": "Scope of Work",
      "body": "The Contractor agrees to perform the following work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"
    },
    {
      "title": "Contract Price",
      "body": "The total contract price for all work described herein shall be {{total}}."
    },
    {
      "title": "Payment Terms",
      "body": "Payment is due upon completion of work unless otherwise agreed in writing. A deposit may be required prior to commencement of work."
    },
    {
      "title": "Warranty",
      "body": "The Contractor warrants all workmanship for a period specified by the manufacturer warranty. Material warranties are provided directly by the manufacturer."
    },
    {
      "title": "Timeline",
      "body": "Work is expected to commence on or about {{date}} and shall be completed within a reasonable timeframe, weather permitting."
    },
    {
      "title": "General Provisions",
      "body": "This contract constitutes the entire agreement between the parties. Any modifications must be made in writing and signed by both parties. The Contractor shall maintain appropriate insurance and licenses throughout the duration of the project."
    }
  ]
}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contract_templates WHERE type = 'standard' AND tenant_id IS NULL);

INSERT INTO contract_templates (tenant_id, name, type, content, is_default)
SELECT NULL, 'Insurance Restoration Contract', 'insurance', '{
  "sections": [
    {
      "title": "Scope of Work",
      "body": "The Contractor agrees to perform storm damage restoration work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"
    },
    {
      "title": "Insurance Information",
      "body": "Insurance Company: {{insurance_company}}\nClaim Number: {{claim_number}}\nDate of Loss: {{date_of_loss}}"
    },
    {
      "title": "Contract Price",
      "body": "The contract price shall be based on the insurance approved scope of repairs.\n\nACV (Actual Cash Value): {{acv}}\nDeductible: {{deductible}}\n\nThe homeowner is responsible for payment of the deductible."
    },
    {
      "title": "Assignment of Benefits",
      "body": "The homeowner hereby assigns all insurance benefits related to the above claim to the Contractor for the purpose of completing the described repairs."
    },
    {
      "title": "Supplement Agreement",
      "body": "The Contractor reserves the right to submit supplements to the insurance company for any additional work discovered during the repair process. The homeowner agrees to cooperate with supplement requests."
    },
    {
      "title": "Warranty",
      "body": "The Contractor warrants all workmanship for a period specified by the manufacturer warranty. Material warranties are provided directly by the manufacturer."
    }
  ]
}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contract_templates WHERE type = 'insurance' AND tenant_id IS NULL);

INSERT INTO contract_templates (tenant_id, name, type, content, is_default)
SELECT NULL, 'Financing Contract', 'financing', '{
  "sections": [
    {
      "title": "Scope of Work",
      "body": "The Contractor agrees to perform the following work at {{address}} for {{customer_name}}:\n\n{{scope_of_work}}"
    },
    {
      "title": "Contract Price",
      "body": "The total contract price for all work described herein shall be {{total}}."
    },
    {
      "title": "Financing Terms",
      "body": "This project is financed through {{lender_name}}.\n\nFinanced Amount: {{financed_amount}}\nMonthly Payment: {{monthly_payment}}\nTerm: {{term_months}} months\nAPR: {{apr}}"
    },
    {
      "title": "Financing Disclosure",
      "body": "The homeowner acknowledges that financing is provided by a third-party lender and is subject to credit approval. The Contractor is not responsible for financing terms, rates, or approval decisions. The homeowner is responsible for all payments to the lender regardless of any disputes with the Contractor."
    },
    {
      "title": "Warranty",
      "body": "The Contractor warrants all workmanship for a period specified by the manufacturer warranty. Material warranties are provided directly by the manufacturer."
    },
    {
      "title": "Timeline",
      "body": "Work is expected to commence on or about {{date}} and shall be completed within a reasonable timeframe, weather permitting."
    }
  ]
}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contract_templates WHERE type = 'financing' AND tenant_id IS NULL);

INSERT INTO contract_templates (tenant_id, name, type, content, is_default)
SELECT NULL, 'Supplement Agreement', 'supplement', '{
  "sections": [
    {
      "title": "Reference",
      "body": "This supplement agreement refers to the original contract dated {{original_contract_date}} between {{customer_name}} and the Contractor for work at {{address}}."
    },
    {
      "title": "Additional Scope",
      "body": "The following additional work has been identified and approved:\n\n{{additional_scope}}"
    },
    {
      "title": "Revised Price",
      "body": "Original Contract Total: {{original_total}}\nSupplement Amount: {{supplement_amount}}\nRevised Total: {{revised_total}}"
    },
    {
      "title": "Agreement",
      "body": "Both parties agree to the additional scope and revised pricing described above. All other terms and conditions of the original contract remain in full effect."
    }
  ]
}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM contract_templates WHERE type = 'supplement' AND tenant_id IS NULL);
