#!/bin/bash
# Systematic API endpoint test
# Usage: bash api-test.sh > /tmp/api-test-results.txt

BASE="http://localhost:3001/api"
TOKEN=$(cat /tmp/api_token.txt)
TENANT_ID=$(cat /tmp/tenant_id.txt)
USER_ID=$(cat /tmp/user_id.txt)

test_endpoint() {
  local method="$1"
  local path="$2"
  local data="$3"
  local description="$4"

  if [ -z "$data" ]; then
    local result=$(curl -s -o /tmp/api_body.txt -w "HTTP_CODE:%{http_code}\n" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" 2>&1)
  else
    local result=$(curl -s -o /tmp/api_body.txt -w "HTTP_CODE:%{http_code}\n" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$data" 2>&1)
  fi

  local code=$(echo "$result" | grep -oE 'HTTP_CODE:[0-9]+' | grep -oE '[0-9]+')
  local body=$(cat /tmp/api_body.txt | head -c 200 | tr '\n' ' ')

  local status_marker="OK"
  if [ "$code" = "500" ] || [ "$code" = "502" ] || [ "$code" = "504" ]; then
    status_marker="CRASH"
  elif [ "$code" = "000" ]; then
    status_marker="NO-CONN"
  fi

  printf "%-6s %-4s %-55s %-6s %s\n" "$status_marker" "$method" "$path" "$code" "$body"
}

echo "================================"
echo "API Endpoint Systematic Test"
echo "Token: ${TOKEN:0:30}..."
echo "Tenant: $TENANT_ID"
echo "================================"

# --- AUTH ---
echo ""
echo "=== AUTH ==="
test_endpoint GET    "/auth/me"
test_endpoint PATCH  "/auth/me" '{}'
# login/register/refresh tested elsewhere (rate-limited)

# --- STORMS ---
echo ""
echo "=== STORMS ==="
test_endpoint GET    "/storms"
test_endpoint GET    "/storms?from=2026-01-01&to=2026-12-31"
test_endpoint GET    "/storms/00000000-0000-0000-0000-000000000000"
test_endpoint GET    "/storms/bad-uuid"

# --- MAP ---
echo ""
echo "=== MAP ==="
test_endpoint GET    "/map/properties?bbox=-100,30,-90,40"
test_endpoint GET    "/map/affected-properties?bbox=-100,30,-90,40"
test_endpoint GET    "/map/swaths"

# --- DASHBOARD ---
echo ""
echo "=== DASHBOARD ==="
test_endpoint GET    "/dashboard/stats"
test_endpoint GET    "/dashboard/funnel"
test_endpoint GET    "/dashboard/activity"

# --- PROPERTIES ---
echo ""
echo "=== PROPERTIES ==="
test_endpoint GET    "/properties"
test_endpoint GET    "/properties/import-progress"
test_endpoint GET    "/properties/reverse-geocode?lat=41.5&lon=-92.3"
test_endpoint GET    "/properties/00000000-0000-0000-0000-000000000000"
test_endpoint GET    "/properties/bad-uuid"

# --- LEADS ---
echo ""
echo "=== LEADS (/leads) ==="
test_endpoint GET    "/leads"
test_endpoint GET    "/leads/00000000-0000-0000-0000-000000000000"
test_endpoint GET    "/leads/bad-uuid"

# --- SKIP TRACE ---
echo ""
echo "=== SKIP-TRACE ==="
test_endpoint GET    "/skip-trace/config"
test_endpoint GET    "/skip-trace/balance"
test_endpoint GET    "/skip-trace/invoices"
test_endpoint GET    "/skip-trace/usage"
test_endpoint GET    "/skip-trace/jobs"
test_endpoint GET    "/skip-trace/job/bad-uuid"

# --- ALERTS ---
echo ""
echo "=== ALERTS ==="
test_endpoint GET    "/alerts/config"
test_endpoint GET    "/alerts/history"

# --- DRIFT ---
echo ""
echo "=== DRIFT ==="
test_endpoint GET    "/drift/bad-uuid"
test_endpoint GET    "/drift/00000000-0000-0000-0000-000000000000"

# --- COUNTIES ---
echo ""
echo "=== COUNTIES ==="
test_endpoint GET    "/counties"

# --- CRM ---
echo ""
echo "=== CRM ==="
test_endpoint GET    "/crm/leads"
test_endpoint GET    "/crm/tasks"
test_endpoint GET    "/crm/pipeline/stages"
test_endpoint GET    "/crm/pipeline/metrics"
test_endpoint GET    "/crm/dashboard/stats"
test_endpoint GET    "/crm/dashboard/activity"
test_endpoint GET    "/crm/team"
test_endpoint GET    "/crm/tenant-settings"
test_endpoint GET    "/crm/dashboard/properties-affected"
test_endpoint GET    "/crm/dashboard/properties-affected/list"
test_endpoint GET    "/crm/dashboard/followups"
test_endpoint GET    "/crm/dashboard/conversion-by-storm"
test_endpoint GET    "/crm/dashboard/estimate-summary"
test_endpoint GET    "/crm/dashboard/ar-summary"
test_endpoint GET    "/crm/dashboard/estimating-conversion"
test_endpoint GET    "/crm/dashboard/leaderboard"
test_endpoint GET    "/crm/dashboard/tasks-today"
test_endpoint GET    "/crm/dashboard/days-in-stage"
test_endpoint GET    "/crm/dashboard/stale-leads"
test_endpoint GET    "/crm/dashboard/customer-storm-alerts"
test_endpoint GET    "/crm/leads/bad-uuid"
test_endpoint GET    "/crm/leads/00000000-0000-0000-0000-000000000000"
test_endpoint GET    "/crm/leads/bad-uuid/activities"

# --- ESTIMATES ---
echo ""
echo "=== ESTIMATES ==="
test_endpoint GET    "/estimates"
test_endpoint GET    "/estimates/templates"
test_endpoint GET    "/estimates/bad-uuid"
test_endpoint GET    "/estimates/00000000-0000-0000-0000-000000000000"
test_endpoint GET    "/estimates/public/nonexistent-token"

# --- CONTRACTS ---
echo ""
echo "=== CONTRACTS ==="
test_endpoint GET    "/crm/contracts"
test_endpoint GET    "/crm/contracts/templates"
test_endpoint GET    "/crm/contracts/bad-uuid"
test_endpoint GET    "/crm/contracts/public/nonexistent-token"

# --- FINANCING ---
echo ""
echo "=== FINANCING ==="
test_endpoint GET    "/crm/financing/lenders"
test_endpoint GET    "/crm/financing/plans"
test_endpoint GET    "/crm/financing/applications"
test_endpoint GET    "/crm/financing/public/nonexistent-token/plans"
test_endpoint GET    "/crm/financing/public/nonexistent-token/applications"

# --- AUTOMATIONS ---
echo ""
echo "=== AUTOMATIONS ==="
test_endpoint GET    "/crm/automations"

# --- INVOICES ---
echo ""
echo "=== INVOICES ==="
test_endpoint GET    "/crm/invoices"
test_endpoint GET    "/crm/invoices/bad-uuid"
test_endpoint GET    "/crm/invoices/00000000-0000-0000-0000-000000000000"

# --- CANVASSING ---
echo ""
echo "=== CANVASSING ==="
test_endpoint GET    "/crm/canvass-pins"
test_endpoint GET    "/crm/canvass-pins/stats"

# --- REPORTS ---
echo ""
echo "=== REPORTS ==="
test_endpoint GET    "/crm/reports/revenue"
test_endpoint GET    "/crm/reports/pipeline"
test_endpoint GET    "/crm/reports/conversion"
test_endpoint GET    "/crm/reports/rep-performance"
test_endpoint GET    "/crm/reports/stage-duration"
test_endpoint GET    "/crm/reports/lead-sources"

# --- WORK ORDERS ---
echo ""
echo "=== WORK ORDERS ==="
test_endpoint GET    "/crm/work-orders/milestone-templates"
test_endpoint GET    "/crm/work-orders"
test_endpoint GET    "/crm/work-orders/bad-uuid"
test_endpoint GET    "/crm/work-orders/00000000-0000-0000-0000-000000000000"

# --- DRIP ---
echo ""
echo "=== DRIP ==="
test_endpoint GET    "/crm/drip-sequences"
test_endpoint GET    "/crm/drip-sequences/bad-uuid"

# --- EXPENSES ---
echo ""
echo "=== EXPENSES ==="
test_endpoint GET    "/crm/expenses"
test_endpoint GET    "/crm/expenses/summary/bad-uuid"
test_endpoint GET    "/crm/expenses/summary/00000000-0000-0000-0000-000000000000"

# --- SUBCONTRACTORS ---
echo ""
echo "=== SUBCONTRACTORS ==="
test_endpoint GET    "/crm/subcontractors"
test_endpoint GET    "/crm/subcontractors/bad-uuid"

# --- TERRITORIES ---
echo ""
echo "=== TERRITORIES ==="
test_endpoint GET    "/crm/territories"
test_endpoint GET    "/crm/territories/bad-uuid"

# --- MATERIALS ---
echo ""
echo "=== MATERIALS ==="
test_endpoint GET    "/materials/products"
test_endpoint GET    "/materials/branches"
test_endpoint GET    "/materials/orders"
test_endpoint GET    "/materials/credentials"
test_endpoint GET    "/materials/orders/bad-uuid"

# --- NOTIFICATIONS ---
echo ""
echo "=== NOTIFICATIONS ==="
test_endpoint GET    "/notifications"
test_endpoint GET    "/notifications/unread-count"
test_endpoint GET    "/notifications/preferences"

# --- SEARCH ---
echo ""
echo "=== SEARCH ==="
test_endpoint GET    "/search?q=test"
test_endpoint GET    "/search"

# --- DOCUMENTS ---
echo ""
echo "=== DOCUMENTS ==="
test_endpoint GET    "/documents"

# --- ROOF MEASUREMENT ---
echo ""
echo "=== ROOF MEASUREMENT ==="
test_endpoint GET    "/roof-measurement/config"
test_endpoint GET    "/roof-measurement/usage"
test_endpoint GET    "/roof-measurement/balance"
test_endpoint GET    "/roof-measurement/segments/bad-uuid"
test_endpoint GET    "/roof-measurement/solar/bad-uuid"

# --- ADMIN ---
echo ""
echo "=== ADMIN ==="
test_endpoint GET    "/admin/overview"
test_endpoint GET    "/admin/tenants"
test_endpoint GET    "/admin/revenue"
test_endpoint GET    "/admin/usage"
test_endpoint GET    "/admin/tenants/bad-uuid"

# --- PAYMENTS ---
echo ""
echo "=== PAYMENTS ==="
test_endpoint GET    "/payments/connect/status"
test_endpoint GET    "/payments/history"

# --- ONBOARDING ---
echo ""
echo "=== ONBOARDING ==="
test_endpoint GET    "/onboarding/plans"

# --- DISASTER DECLARATIONS ---
echo ""
echo "=== DISASTER DECLARATIONS ==="
test_endpoint GET    "/disaster-declarations"

# --- STORM HISTORY ---
echo ""
echo "=== STORM HISTORY ==="
test_endpoint GET    "/storm-history"
test_endpoint GET    "/storm-history/heatmap"

# --- DATA APIS ---
echo ""
echo "=== DATA APIS ==="
test_endpoint GET    "/data/fema-housing?lat=41.5&lon=-92.3"
test_endpoint GET    "/data/directions?origin=41.5,-92.3&destination=41.6,-92.4"

echo ""
echo "=== POST/PATCH/DELETE with empty/missing body (should 400 not 500) ==="
test_endpoint POST   "/crm/leads" '{}'
test_endpoint POST   "/crm/leads/quick" '{}'
test_endpoint POST   "/crm/activities" '{}'
test_endpoint POST   "/crm/tasks" '{}'
test_endpoint POST   "/crm/team/invite" '{}'
test_endpoint POST   "/crm/leads/bulk-assign" '{}'
test_endpoint POST   "/crm/leads/bulk-status" '{}'
test_endpoint POST   "/crm/test-email" '{}'
test_endpoint POST   "/estimates" '{}'
test_endpoint POST   "/estimates/templates" '{}'
test_endpoint POST   "/crm/contracts" '{}'
test_endpoint POST   "/crm/contracts/templates" '{}'
test_endpoint POST   "/crm/financing/lenders" '{}'
test_endpoint POST   "/crm/financing/applications" '{}'
test_endpoint POST   "/crm/invoices" '{}'
test_endpoint POST   "/crm/work-orders" '{}'
test_endpoint POST   "/crm/canvass-pins" '{}'
test_endpoint POST   "/crm/drip-sequences" '{}'
test_endpoint POST   "/crm/expenses" '{}'
test_endpoint POST   "/crm/subcontractors" '{}'
test_endpoint POST   "/crm/territories" '{}'
test_endpoint POST   "/crm/automations" '{}'
test_endpoint POST   "/materials/orders" '{}'
test_endpoint POST   "/leads/from-storm" '{}'
test_endpoint POST   "/properties" '{}'
test_endpoint POST   "/properties/generate-leads" '{}'
test_endpoint POST   "/properties/geocode" '{}'
test_endpoint POST   "/counties" '{}'
test_endpoint POST   "/drift/simulate" '{}'
test_endpoint POST   "/drift/calibrate" '{}'
test_endpoint POST   "/alerts/test" '{}'
test_endpoint PUT    "/alerts/config" '{}'
test_endpoint PUT    "/skip-trace/config" '{}'
test_endpoint PUT    "/roof-measurement/config" '{}'
test_endpoint PATCH  "/notifications/preferences" '{}'
test_endpoint POST   "/notifications/mark-all-read"
test_endpoint PUT    "/crm/tenant-settings" '{}'

echo ""
echo "=== DONE ==="
