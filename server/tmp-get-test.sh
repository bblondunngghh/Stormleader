#!/bin/bash
source /tmp/token.env
BASE=http://localhost:3001

test_get() {
  local path="$1"
  local status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" "$BASE$path" -H "Authorization: Bearer $TOKEN" --max-time 15)
  local resp=$(cat /tmp/resp-$$ 2>/dev/null | head -c 300)
  rm -f /tmp/resp-$$
  printf "%s %s\t%s\n" "$status" "$path" "$resp"
}

for p in \
  /api/auth/me \
  /api/storms \
  /api/dashboard/stats \
  /api/dashboard/funnel \
  /api/dashboard/activity \
  /api/counties \
  /api/crm/leads \
  /api/crm/tasks \
  /api/crm/team \
  /api/crm/pipeline/stages \
  /api/crm/pipeline/metrics \
  /api/crm/dashboard/stats \
  /api/crm/dashboard/activity \
  /api/crm/dashboard/properties-affected \
  /api/crm/dashboard/properties-affected/list \
  /api/crm/dashboard/followups \
  /api/crm/dashboard/conversion-by-storm \
  /api/crm/dashboard/estimate-summary \
  /api/crm/dashboard/ar-summary \
  /api/crm/dashboard/estimating-conversion \
  /api/crm/dashboard/leaderboard \
  /api/crm/dashboard/tasks-today \
  /api/crm/dashboard/days-in-stage \
  /api/crm/dashboard/stale-leads \
  /api/crm/dashboard/customer-storm-alerts \
  /api/crm/dashboard/lead-source-revenue \
  /api/crm/prospect-lists \
  /api/crm/calendar \
  /api/crm/custom-fields \
  /api/crm/tenant-settings \
  /api/crm/automations \
  /api/crm/invoices \
  /api/crm/canvass-pins \
  /api/crm/canvass-pins/stats \
  /api/crm/work-orders \
  /api/crm/work-orders/milestone-templates \
  /api/crm/drip-sequences \
  /api/crm/expenses \
  /api/crm/subcontractors \
  /api/crm/territories \
  /api/crm/contracts \
  /api/crm/contracts/templates \
  /api/crm/financing/lenders \
  /api/crm/financing/plans \
  /api/crm/financing/applications \
  /api/crm/reports/revenue \
  /api/crm/reports/pipeline \
  /api/crm/reports/conversion \
  /api/crm/reports/rep-performance \
  /api/crm/reports/stage-duration \
  /api/crm/reports/lead-sources \
  /api/leads \
  /api/notifications \
  /api/notifications/unread-count \
  /api/notifications/preferences \
  /api/estimates \
  /api/estimates/templates \
  /api/documents \
  /api/search?q=test \
  /api/roof-measurement/config \
  /api/roof-measurement/usage \
  /api/roof-measurement/balance \
  /api/skip-trace/config \
  /api/skip-trace/balance \
  /api/skip-trace/usage \
  /api/skip-trace/invoices \
  /api/skip-trace/jobs \
  /api/alerts/config \
  /api/alerts/history \
  /api/admin/overview \
  /api/admin/tenants \
  /api/admin/revenue \
  /api/admin/usage \
  /api/payments/history \
  /api/payments/connect/status \
  /api/onboarding/plans \
  /api/materials/products \
  /api/materials/branches \
  /api/materials/orders \
  /api/materials/credentials \
  ; do
  test_get "$p"
done
