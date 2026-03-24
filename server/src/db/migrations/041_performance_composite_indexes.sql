-- 041_performance_composite_indexes.sql
-- Composite indexes for frequent multi-column filter queries

-- tasks: dashboard "tasks due today" query filters by tenant + status + due_date
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_due
  ON tasks(tenant_id, status, due_date)
  WHERE completed_at IS NULL;

-- activities: user activity feed ordered by created_at
CREATE INDEX IF NOT EXISTS idx_activities_user_created
  ON activities(user_id, created_at DESC);
