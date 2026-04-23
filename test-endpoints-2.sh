#!/bin/bash
BASE="http://localhost:3001/api"
TOKEN=$(cat /tmp/token.txt)
OUT="/tmp/api-test-results.txt"

test_endpoint() {
  local method="$1"
  local path="$2"
  local data="$3"
  local url="${BASE}${path}"
  local response
  local status
  if [ -n "$data" ]; then
    response=$(curl -s -o /tmp/resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -o /tmp/resp.txt -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN")
  fi
  status=$response
  local body=$(head -c 200 /tmp/resp.txt | tr '\n' ' ' | tr '|' ' ')
  local flag=""
  if [ "$status" = "500" ] || [ "$status" = "502" ] || [ "$status" = "000" ]; then
    flag=" ⚠️ BROKEN"
  fi
  echo "| $method | $path | $status |$flag ${body:0:80} |" >> "$OUT"
  echo "$method $path -> $status${flag}"
}

echo "## Round 2: GETs with required params & POSTs" >> "$OUT"
# GETs with proper params
test_endpoint GET "/properties?bbox=-90.5,41.5,-90.0,41.9"
test_endpoint GET "/properties/fema-live?bbox=-90.5,41.5,-90.2,41.7"
test_endpoint GET "/map/affected-properties?bbox=-90.5,41.5,-90.0,41.9"
test_endpoint GET "/map/swaths?bbox=-90.5,41.5,-90.0,41.9"
test_endpoint GET "/crm/calendar?start=2026-04-01&end=2026-05-01"
test_endpoint GET "/disaster-declarations?state=IA&county=Blackhawk"
test_endpoint GET "/storm-history?lat=41.5&lng=-90.5"
test_endpoint GET "/storm-history/heatmap?bbox=-90.5,41.5,-90.0,41.9"
test_endpoint GET "/data/fema-housing?zip=50701"
test_endpoint GET "/data/directions?fromLat=41.5&fromLng=-90.5&toLat=41.6&toLng=-90.4"

# Error handling: test POSTs with empty body (should 400, not 500)
test_endpoint POST "/crm/leads" "{}"
test_endpoint POST "/crm/leads/quick" "{}"
test_endpoint POST "/crm/tasks" "{}"
test_endpoint POST "/crm/activities" "{}"
test_endpoint POST "/crm/automations" "{}"
test_endpoint POST "/crm/prospect-lists" "{}"
test_endpoint POST "/crm/custom-fields" "{}"
test_endpoint POST "/crm/canvass-pins" "{}"
test_endpoint POST "/crm/drip-sequences" "{}"
test_endpoint POST "/crm/contracts" "{}"
test_endpoint POST "/crm/contracts/templates" "{}"
test_endpoint POST "/crm/expenses" "{}"
test_endpoint POST "/crm/subcontractors" "{}"
test_endpoint POST "/crm/subcontractors/assign" "{}"
test_endpoint POST "/crm/territories" "{}"
test_endpoint POST "/crm/financing/lenders" "{}"
test_endpoint POST "/crm/financing/applications" "{}"
test_endpoint POST "/crm/financing/plans/sync" "{}"
test_endpoint POST "/crm/invoices" "{}"
test_endpoint POST "/estimates" "{}"
test_endpoint POST "/estimates/templates" "{}"
test_endpoint POST "/documents/upload" ""
test_endpoint POST "/properties" "{}"
test_endpoint POST "/properties/generate-leads" "{}"
test_endpoint POST "/properties/geocode" "{}"
test_endpoint POST "/properties/import-csv" "{}"
test_endpoint POST "/properties/trigger-import" "{}"
test_endpoint POST "/properties/fema-live-polygon" "{}"
test_endpoint POST "/leads/from-storm" "{}"
test_endpoint POST "/crm/test-email" "{}"
test_endpoint POST "/crm/team/invite" "{}"
test_endpoint POST "/counties" "{}"
test_endpoint POST "/alerts/test" "{}"
test_endpoint POST "/drift/correct-all" "{}"
test_endpoint POST "/drift/simulate" "{}"
test_endpoint POST "/drift/calibrate" "{}"
test_endpoint POST "/crm/work-orders" "{}"
test_endpoint POST "/materials/orders" "{}"
test_endpoint POST "/skip-trace/submit" "{}"
test_endpoint POST "/skip-trace/setup-payment" "{}"
test_endpoint POST "/roof-measurement/measure" "{}"
test_endpoint POST "/roof-measurement/manual" "{}"
test_endpoint POST "/crm/leads/bulk-assign" "{}"
test_endpoint POST "/crm/leads/bulk-status" "{}"
test_endpoint POST "/crm/leads/score-all" "{}"
test_endpoint POST "/data/optimize-route" "{}"

# PATCH/PUT config endpoints
test_endpoint PUT "/alerts/config" "{}"
test_endpoint PUT "/roof-measurement/config" "{}"
test_endpoint PUT "/skip-trace/config" "{}"
test_endpoint PUT "/crm/tenant-settings" "{}"
test_endpoint PATCH "/notifications/preferences" "{}"
test_endpoint PATCH "/auth/me" "{}"

echo "Done"
