#!/usr/bin/env bash
# QA API harness — hits every GET endpoint, logs status codes, flags 5xx.
# Usage: bash scripts/qa-api-harness.sh > /tmp/api-results.txt
set -uo pipefail

BASE="${BASE:-http://localhost:3001/api}"
TOKEN="${TOKEN:-}"
if [[ -z "$TOKEN" && -f /tmp/tok.txt ]]; then
  TOKEN=$(cat /tmp/tok.txt)
fi
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: TOKEN not set and /tmp/tok.txt not found" >&2
  exit 1
fi
H="Authorization: Bearer $TOKEN"

# Test fixture IDs — bad UUID, real-looking UUID
BAD_UUID="not-a-uuid"
FAKE_UUID="00000000-0000-0000-0000-000000000000"

# Helper: hit an endpoint, log "STATUS METHOD PATH"
hit() {
  local method="$1" path="$2" body="${3:-}" expect="${4:-}"
  local code body_file resp_size
  body_file=$(mktemp)
  if [[ -n "$body" ]]; then
    code=$(curl -s -o "$body_file" -w "%{http_code}" -m 15 -X "$method" "$BASE$path" \
      -H "$H" -H 'Content-Type: application/json' -d "$body")
  else
    code=$(curl -s -o "$body_file" -w "%{http_code}" -m 15 -X "$method" "$BASE$path" -H "$H")
  fi
  resp_size=$(wc -c < "$body_file")
  local flag=""
  if [[ "$code" == 5* ]]; then flag=" *** 5xx ***"; fi
  echo "$code $method $path${expect:+ (expect $expect)} (${resp_size}b)$flag"
  if [[ "$code" == 5* ]]; then
    echo "  BODY: $(head -c 400 "$body_file")"
  fi
  rm -f "$body_file"
}

echo "=== POSITIVE GET ENDPOINTS ==="

# auth
hit GET  /auth/me

# storms
hit GET  /storms
hit GET  /storms/$FAKE_UUID

# map
hit GET  /map/properties
hit GET  /map/affected-properties
hit GET  /map/swaths

# dashboard
hit GET  /dashboard/stats
hit GET  /dashboard/funnel
hit GET  /dashboard/activity

# properties
hit GET  /properties
hit GET  /properties/import-progress
hit GET  /properties/in-swath/$FAKE_UUID/count
hit GET  /properties/in-swath/$FAKE_UUID
hit GET  "/properties/reverse-geocode?lat=40.5&lon=-80.5"
hit GET  /properties/$FAKE_UUID

# leads
hit GET  /leads
hit GET  /leads/$FAKE_UUID

# skip-trace
hit GET  /skip-trace/config
hit GET  /skip-trace/balance
hit GET  /skip-trace/invoices
hit GET  /skip-trace/usage
hit GET  /skip-trace/jobs

# alerts
hit GET  /alerts/config
hit GET  /alerts/history

# drift
hit GET  /drift/$FAKE_UUID

# counties
hit GET  /counties

# crm — leads / leads-tools
hit GET  /crm/leads
hit GET  /crm/leads/$FAKE_UUID
hit GET  /crm/leads/$FAKE_UUID/activities

# crm — tasks / pipeline / dashboard / team
hit GET  /crm/tasks
hit GET  /crm/pipeline/stages
hit GET  /crm/pipeline/metrics
hit GET  /crm/dashboard/stats
hit GET  /crm/dashboard/activity
hit GET  /crm/team
hit GET  /crm/tenant-settings

# crm — dashboard widgets
hit GET  /crm/dashboard/properties-affected
hit GET  /crm/dashboard/properties-affected/list
hit GET  /crm/dashboard/followups
hit GET  /crm/dashboard/conversion-by-storm
hit GET  /crm/dashboard/estimate-summary
hit GET  /crm/dashboard/ar-summary
hit GET  /crm/dashboard/estimating-conversion
hit GET  /crm/dashboard/leaderboard
hit GET  /crm/dashboard/tasks-today
hit GET  /crm/dashboard/days-in-stage
hit GET  /crm/dashboard/stale-leads
hit GET  /crm/dashboard/customer-storm-alerts
hit GET  /crm/dashboard/lead-source-revenue

# crm — prospect lists / calendar / custom-fields
hit GET  /crm/prospect-lists
hit GET  /crm/prospect-lists/$FAKE_UUID/items
hit GET  /crm/calendar
hit GET  /crm/custom-fields

# estimates
hit GET  /estimates
hit GET  /estimates/templates
hit GET  /estimates/$FAKE_UUID

# notifications
hit GET  /notifications
hit GET  /notifications/unread-count
hit GET  /notifications/preferences

# search
hit GET  "/search?q=test"

# documents
hit GET  /documents

# roof-measurement
hit GET  /roof-measurement/config
hit GET  /roof-measurement/usage
hit GET  /roof-measurement/balance
hit GET  /roof-measurement/segments/$FAKE_UUID
hit GET  /roof-measurement/solar/$FAKE_UUID

# admin
hit GET  /admin/overview
hit GET  /admin/tenants
hit GET  /admin/tenants/$FAKE_UUID
hit GET  /admin/revenue
hit GET  /admin/usage

# materials
hit GET  /materials/products
hit GET  /materials/products/$FAKE_UUID
hit GET  /materials/branches
hit GET  /materials/orders
hit GET  /materials/orders/$FAKE_UUID
hit GET  /materials/credentials

# crm/financing
hit GET  /crm/financing/lenders
hit GET  /crm/financing/plans
hit GET  /crm/financing/applications
hit GET  /crm/financing/applications/$FAKE_UUID

# crm/contracts
hit GET  /crm/contracts/templates
hit GET  /crm/contracts
hit GET  /crm/contracts/$FAKE_UUID

# crm/automations
hit GET  /crm/automations

# crm/invoices
hit GET  /crm/invoices
hit GET  /crm/invoices/$FAKE_UUID

# crm/canvass-pins
hit GET  /crm/canvass-pins
hit GET  /crm/canvass-pins/stats

# crm/reports
hit GET  /crm/reports/revenue
hit GET  /crm/reports/pipeline
hit GET  /crm/reports/conversion
hit GET  /crm/reports/rep-performance
hit GET  /crm/reports/stage-duration
hit GET  /crm/reports/lead-sources

# crm/work-orders
hit GET  /crm/work-orders/milestone-templates
hit GET  /crm/work-orders
hit GET  /crm/work-orders/$FAKE_UUID
hit GET  /crm/work-orders/$FAKE_UUID/milestones

# crm/drip-sequences
hit GET  /crm/drip-sequences
hit GET  /crm/drip-sequences/$FAKE_UUID
hit GET  /crm/drip-sequences/$FAKE_UUID/enrollments

# crm/expenses
hit GET  /crm/expenses
hit GET  /crm/expenses/summary/$FAKE_UUID

# crm/subcontractors
hit GET  /crm/subcontractors
hit GET  /crm/subcontractors/$FAKE_UUID
hit GET  /crm/subcontractors/work-order/$FAKE_UUID

# crm/territories
hit GET  /crm/territories
hit GET  /crm/territories/$FAKE_UUID
hit GET  /crm/territories/$FAKE_UUID/pins

# disaster-declarations / storm-history
hit GET  /disaster-declarations
hit GET  /storm-history
hit GET  /storm-history/heatmap

# data
hit GET  "/data/fema-housing?lat=40.5&lon=-80.5"
hit GET  "/data/directions?fromLat=40.5&fromLon=-80.5&toLat=40.6&toLon=-80.6"

# onboarding
hit GET  /onboarding/plans

# payments
hit GET  /payments/connect/status
hit GET  /payments/history

echo
echo "=== BAD UUID PROBES (must return 400, not 500) ==="
hit GET  /storms/$BAD_UUID 400
hit GET  /properties/$BAD_UUID 400
hit GET  /properties/in-swath/$BAD_UUID/count 400
hit GET  /properties/in-swath/$BAD_UUID 400
hit GET  /leads/$BAD_UUID 400
hit GET  /drift/$BAD_UUID 400
hit GET  /crm/leads/$BAD_UUID 400
hit GET  /crm/leads/$BAD_UUID/activities 400
hit GET  /crm/prospect-lists/$BAD_UUID/items 400
hit GET  /estimates/$BAD_UUID 400
hit GET  /admin/tenants/$BAD_UUID 400
hit GET  /materials/orders/$BAD_UUID 400
hit GET  /crm/financing/applications/$BAD_UUID 400
hit GET  /crm/contracts/$BAD_UUID 400
hit GET  /crm/invoices/$BAD_UUID 400
hit GET  /crm/work-orders/$BAD_UUID 400
hit GET  /crm/work-orders/$BAD_UUID/milestones 400
hit GET  /crm/drip-sequences/$BAD_UUID 400
hit GET  /crm/drip-sequences/$BAD_UUID/enrollments 400
hit GET  /crm/expenses/summary/$BAD_UUID 400
hit GET  /crm/subcontractors/$BAD_UUID 400
hit GET  /crm/subcontractors/work-order/$BAD_UUID 400
hit GET  /crm/territories/$BAD_UUID 400
hit GET  /crm/territories/$BAD_UUID/pins 400
hit GET  /roof-measurement/segments/$BAD_UUID 400
hit GET  /roof-measurement/solar/$BAD_UUID 400
hit GET  /skip-trace/job/$BAD_UUID 400

echo
echo "=== EMPTY-BODY POST/PATCH PROBES (must return 400, not 500) ==="
hit POST  /alerts/test '{}' 400
hit POST  /counties '{}' 400
hit POST  /crm/leads '{}' 400
hit POST  /crm/leads/quick '{}' 400
hit POST  /crm/leads/bulk-assign '{}' 400
hit POST  /crm/leads/bulk-status '{}' 400
hit POST  /crm/activities '{}' 400
hit POST  /crm/tasks '{}' 400
hit POST  /crm/team/invite '{}' 400
hit POST  /crm/test-email '{}' 400
hit POST  /crm/prospect-lists '{}' 400
hit POST  /crm/custom-fields '{}' 400
hit POST  /estimates '{}' 400
hit POST  /estimates/templates '{}' 400
hit POST  /crm/automations '{}' 400
hit POST  /crm/invoices '{}' 400
hit POST  /crm/canvass-pins '{}' 400
hit POST  /crm/work-orders '{}' 400
hit POST  /crm/drip-sequences '{}' 400
hit POST  /crm/expenses '{}' 400
hit POST  /crm/subcontractors '{}' 400
hit POST  /crm/subcontractors/assign '{}' 400
hit POST  /crm/territories '{}' 400
hit POST  /crm/financing/lenders '{}' 400
hit POST  /crm/financing/applications '{}' 400
hit POST  /crm/contracts '{}' 400
hit POST  /crm/contracts/templates '{}' 400
hit POST  /materials/orders '{}' 400
hit POST  /properties/geocode '{}' 400
hit POST  /properties/generate-leads '{}' 400
hit POST  /properties '{}' 400
hit POST  /skip-trace/submit '{}' 400
hit POST  /roof-measurement/measure '{}' 400
hit POST  /roof-measurement/manual '{}' 400
hit POST  /drift/correct-all '{}' 400
hit POST  /drift/simulate '{}' 400
hit POST  /drift/calibrate '{}' 400
hit POST  /dataApis/optimize-route '{}' 400 || true

echo
echo "=== DONE ==="
