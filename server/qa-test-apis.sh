#!/bin/bash
# QA test harness — hits every no-param GET endpoint and logs status.
TOKEN=$(cat /tmp/qa-token.txt)
BASE=http://localhost:3001/api
OUT=/tmp/api-test-results.txt
echo "| Method | Endpoint | Status | Notes |" > $OUT
echo "|--------|----------|--------|-------|" >> $OUT

test_endpoint() {
  local method=$1
  local path=$2
  local body=$3
  local notes=$4
  local url="$BASE$path"
  local curl_args="-s -o /tmp/qa-resp.txt -w %{http_code} -X $method -H Authorization:Bearer\ $TOKEN"
  if [ -n "$body" ]; then
    status=$(curl -s -o /tmp/qa-resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    status=$(curl -s -o /tmp/qa-resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN")
  fi
  local resp=$(head -c 200 /tmp/qa-resp.txt | tr -d '\n' | sed 's/|/\\|/g')
  echo "| $method | $path | $status | $notes $resp |" >> $OUT
  if [ "$status" = "500" ] || [ "$status" = "000" ]; then
    echo "FAIL $method $path -> $status: $resp"
  fi
}

# === AUTH ===
test_endpoint GET /auth/me

# === DASHBOARD ===
test_endpoint GET /dashboard
test_endpoint GET /dashboard/stats
test_endpoint GET /dashboard/funnel
test_endpoint GET /dashboard/activity
test_endpoint GET /dashboard/leaderboard
test_endpoint GET /dashboard/tasks-today

# === STORMS ===
test_endpoint GET /storms
test_endpoint GET /storms/recent
test_endpoint GET /storms/stats

# === MAP ===
test_endpoint GET /map/hail-swaths
test_endpoint GET /map/storms
test_endpoint GET /map/alerts

# === PROPERTIES ===
test_endpoint GET /properties
test_endpoint GET /properties/stats

# === LEADS ===
test_endpoint GET /leads
test_endpoint GET /leads/stats

# === COUNTIES ===
test_endpoint GET /counties
test_endpoint GET /counties/TX

# === ALERTS ===
test_endpoint GET /alerts/config
test_endpoint GET /alerts/history

# === DRIFT ===
test_endpoint GET /drift

# === CRM — leads/tasks/etc ===
test_endpoint GET /crm/leads
test_endpoint GET /crm/contacts
test_endpoint GET /crm/tasks
test_endpoint GET /crm/tasks/today
test_endpoint GET /crm/activities
test_endpoint GET /crm/pipeline-stages
test_endpoint GET /crm/appointments
test_endpoint GET /crm/team
test_endpoint GET /crm/estimates
test_endpoint GET /crm/estimates/templates
test_endpoint GET /crm/notifications
test_endpoint GET /crm/notifications/unread-count
test_endpoint GET /crm/search?q=test
test_endpoint GET /crm/leaderboard
test_endpoint GET /crm/analytics
test_endpoint GET /crm/pipeline
test_endpoint GET /crm/measurements

# === CRM AUTOMATIONS / INVOICES / WO / REPORTS ===
test_endpoint GET /crm/automations
test_endpoint GET /crm/invoices
test_endpoint GET /crm/invoices/stats
test_endpoint GET /crm/work-orders
test_endpoint GET /crm/work-orders/stats
test_endpoint GET /crm/reports
test_endpoint GET /crm/drip-sequences
test_endpoint GET /crm/canvass-pins
test_endpoint GET /crm/canvass-pins/stats
test_endpoint GET /crm/expenses
test_endpoint GET /crm/expenses/stats
test_endpoint GET /crm/subcontractors
test_endpoint GET /crm/territories
test_endpoint GET /crm/financing
test_endpoint GET /crm/financing/plans
test_endpoint GET /crm/contracts

# === ESTIMATES ===
test_endpoint GET /estimates
test_endpoint GET /estimates/templates

# === NOTIFICATIONS ===
test_endpoint GET /notifications
test_endpoint GET /notifications/unread-count

# === SEARCH ===
test_endpoint GET /search?q=test

# === DOCUMENTS ===
test_endpoint GET /documents

# === MATERIALS ===
test_endpoint GET /materials
test_endpoint GET /materials/categories

# === ONBOARDING ===
test_endpoint GET /onboarding/status

# === ADMIN ===
test_endpoint GET /admin/overview
test_endpoint GET /admin/tenants
test_endpoint GET /admin/revenue
test_endpoint GET /admin/usage

# === DISASTER DECLARATIONS ===
test_endpoint GET /disaster-declarations

# === STORM HISTORY ===
test_endpoint GET /storm-history

# === DATA APIs ===
test_endpoint GET /data/census-blocks
test_endpoint GET /data/fema-nsi

# === POST endpoints with empty body (should return 400, not 500) ===
test_endpoint POST /crm/leads '' "empty-body"
test_endpoint POST /crm/contacts '' "empty-body"
test_endpoint POST /crm/tasks '' "empty-body"
test_endpoint POST /crm/activities '' "empty-body"
test_endpoint POST /crm/estimates '' "empty-body"
test_endpoint POST /crm/automations '' "empty-body"
test_endpoint POST /crm/invoices '' "empty-body"
test_endpoint POST /crm/work-orders '' "empty-body"
test_endpoint POST /crm/drip-sequences '' "empty-body"
test_endpoint POST /crm/canvass-pins '' "empty-body"
test_endpoint POST /crm/expenses '' "empty-body"
test_endpoint POST /crm/subcontractors '' "empty-body"
test_endpoint POST /crm/territories '' "empty-body"
test_endpoint POST /crm/test-email '' "empty-body"
test_endpoint POST /estimates '' "empty-body"

# === Bad UUID params (should return 400, not 500) ===
test_endpoint GET /crm/leads/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/contacts/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/tasks/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/estimates/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/invoices/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/work-orders/not-a-uuid '' "bad-uuid"
test_endpoint GET /crm/automations/not-a-uuid '' "bad-uuid"

echo "Done. Results in $OUT"
wc -l $OUT
