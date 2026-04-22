#!/bin/bash
source /tmp/token.env
BASE=http://localhost:3001

# Test endpoint:
# method path body_or_empty
test_post() {
  local method="$1"
  local path="$2"
  local body="$3"
  local hdrs="-H 'Authorization: Bearer $TOKEN'"
  local status resp
  if [ -z "$body" ]; then
    status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" --max-time 15)
  else
    status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body" --max-time 15)
  fi
  resp=$(cat /tmp/resp-$$ 2>/dev/null | head -c 300)
  rm -f /tmp/resp-$$
  printf "%s %s %s\n  -> %s\n" "$status" "$method" "$path" "$resp"
}

echo "=== Empty body POST tests (should return 400, not 500) ==="
test_post POST /api/crm/leads ''
test_post POST /api/crm/leads/quick ''
test_post POST /api/crm/leads/bulk-assign ''
test_post POST /api/crm/leads/bulk-status ''
test_post POST /api/crm/leads/score-all ''
test_post POST /api/crm/activities ''
test_post POST /api/crm/tasks ''
test_post POST /api/crm/team/invite ''
test_post PUT  /api/crm/tenant-settings ''
test_post POST /api/crm/test-email ''
test_post POST /api/crm/prospect-lists ''
test_post POST /api/crm/custom-fields ''
test_post POST /api/crm/automations ''
test_post POST /api/crm/invoices ''
test_post POST /api/crm/canvass-pins ''
test_post POST /api/crm/work-orders ''
test_post POST /api/crm/drip-sequences ''
test_post POST /api/crm/expenses ''
test_post POST /api/crm/subcontractors ''
test_post POST /api/crm/subcontractors/assign ''
test_post POST /api/crm/territories ''
test_post POST /api/crm/contracts ''
test_post POST /api/crm/contracts/templates ''
test_post POST /api/crm/financing/lenders ''
test_post POST /api/crm/financing/plans/sync ''
test_post POST /api/crm/financing/applications ''
test_post POST /api/estimates ''
test_post POST /api/estimates/templates ''
test_post POST /api/documents/upload ''
test_post PUT  /api/skip-trace/config ''
test_post POST /api/skip-trace/setup-payment ''
test_post POST /api/skip-trace/submit ''
test_post PUT  /api/alerts/config ''
test_post POST /api/alerts/test ''
test_post POST /api/leads/from-storm ''
test_post POST /api/properties/generate-leads ''
test_post POST /api/properties/geocode ''
test_post POST /api/properties ''
test_post POST /api/drift/correct-all ''
test_post POST /api/drift/simulate ''
test_post POST /api/drift/calibrate ''
test_post POST /api/roof-measurement/measure ''
test_post POST /api/roof-measurement/manual ''
test_post PUT  /api/roof-measurement/config ''
test_post POST /api/onboarding/complete ''
test_post POST /api/materials/orders ''
test_post PUT  /api/materials/credentials ''
test_post POST /api/counties ''
test_post POST /api/data/optimize-route ''

echo ""
echo "=== Bad UUID tests (should return 400, not 500) ==="
BAD="not-a-uuid"
test_post GET  /api/leads/$BAD ''
test_post GET  /api/crm/leads/$BAD ''
test_post PATCH /api/crm/leads/$BAD '{}'
test_post GET  /api/estimates/$BAD ''
test_post GET  /api/crm/invoices/$BAD ''
test_post GET  /api/crm/work-orders/$BAD ''
test_post GET  /api/crm/contracts/$BAD ''
test_post GET  /api/crm/territories/$BAD ''
test_post GET  /api/crm/subcontractors/$BAD ''
test_post GET  /api/crm/financing/applications/$BAD ''
test_post GET  /api/crm/drip-sequences/$BAD ''
test_post GET  /api/drift/$BAD ''
test_post GET  /api/storms/$BAD ''
test_post GET  /api/properties/$BAD ''
test_post GET  /api/crm/prospect-lists/$BAD/items ''
test_post DELETE /api/crm/prospect-lists/$BAD ''

echo ""
echo "=== Public endpoints (no auth) ==="
test_post GET /api/leads/status/public/invalid_token ''
test_post GET /api/estimates/public/invalid_token ''
test_post GET /api/crm/contracts/public/invalid_token ''
test_post GET /api/crm/financing/public/invalid_token/plans ''
test_post GET /api/crm/financing/public/invalid_token/applications ''
test_post POST /api/crm/financing/public/invalid_token/apply ''

echo ""
echo "=== Nonexistent UUIDs (should return 404) ==="
NULL_ID="00000000-0000-0000-0000-000000000000"
test_post GET /api/leads/$NULL_ID ''
test_post GET /api/crm/leads/$NULL_ID ''
test_post GET /api/estimates/$NULL_ID ''
test_post GET /api/crm/invoices/$NULL_ID ''
test_post GET /api/crm/work-orders/$NULL_ID ''
test_post GET /api/crm/contracts/$NULL_ID ''
test_post GET /api/crm/territories/$NULL_ID ''
test_post GET /api/crm/subcontractors/$NULL_ID ''
test_post GET /api/properties/$NULL_ID ''
