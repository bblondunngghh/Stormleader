-- 035_optimization_indexes.sql
-- Performance indexes for new feature tables

-- invoices: lookup by estimate, overdue queries
CREATE INDEX IF NOT EXISTS idx_invoices_estimate ON invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status NOT IN ('paid', 'void');

-- work_orders: lookup by assigned user and estimate
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_estimate ON work_orders(estimate_id);

-- activities: per-user activity feed
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);

-- contacts: email lookup for deduplication
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- estimates: lookup by creator
CREATE INDEX IF NOT EXISTS idx_estimates_created_by ON estimates(created_by);
