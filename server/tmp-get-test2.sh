#!/bin/bash
source /tmp/token.env
BASE=http://localhost:3001

test_get() {
  local path="$1"
  local status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" "$BASE$path" -H "Authorization: Bearer $TOKEN" --max-time 15)
  local resp=$(cat /tmp/resp-$$ 2>/dev/null | head -c 300)
  rm -f /tmp/resp-$$
  printf "%s %s\n  -> %s\n" "$status" "$path" "$resp"
}

# Endpoints with query params
test_get "/api/crm/calendar?start=2026-04-01&end=2026-04-30"
test_get "/api/properties?bbox=-97.9,30.1,-97.3,30.6"
test_get "/api/storm-history?lat=30.27&lng=-97.74"
test_get "/api/disaster-declarations?state=TX&county=Travis"
test_get "/api/data/fema-housing?state=TX"
test_get "/api/data/directions?origin=30.27,-97.74&destination=30.3,-97.7"
test_get "/api/map/properties?bbox=-97.9,30.1,-97.3,30.6"
test_get "/api/map/affected-properties"
test_get "/api/map/swaths"
test_get "/api/properties/reverse-geocode?lat=30.27&lng=-97.74"

# Get a storm UUID to use for drift/properties-in-swath
STORM_ID=$(curl -s "$BASE/api/storms" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.features&&x.features[0])console.log(x.features[0].id);})" )
echo "STORM_ID=$STORM_ID"
if [ -n "$STORM_ID" ]; then
  test_get "/api/storms/$STORM_ID"
  test_get "/api/properties/in-swath/$STORM_ID/count"
  test_get "/api/properties/in-swath/$STORM_ID?limit=5"
  test_get "/api/drift/$STORM_ID"
fi

# Get a lead UUID to test lead activities
LEAD_ID=$(curl -s "$BASE/api/crm/leads?limit=1" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.leads&&x.leads[0])console.log(x.leads[0].id);})")
echo "LEAD_ID=$LEAD_ID"
if [ -n "$LEAD_ID" ]; then
  test_get "/api/leads/$LEAD_ID"
  test_get "/api/crm/leads/$LEAD_ID"
  test_get "/api/crm/leads/$LEAD_ID/activities"
fi

# estimate id
EST_ID=$(curl -s "$BASE/api/estimates?limit=1" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.estimates&&x.estimates[0])console.log(x.estimates[0].id);})")
echo "EST_ID=$EST_ID"
if [ -n "$EST_ID" ]; then
  test_get "/api/estimates/$EST_ID"
fi

# invoice id
INV_ID=$(curl -s "$BASE/api/crm/invoices" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.invoices&&x.invoices[0])console.log(x.invoices[0].id);})")
echo "INV_ID=$INV_ID"
if [ -n "$INV_ID" ]; then
  test_get "/api/crm/invoices/$INV_ID"
fi

# work order id
WO_ID=$(curl -s "$BASE/api/crm/work-orders" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.workOrders&&x.workOrders[0])console.log(x.workOrders[0].id);})")
echo "WO_ID=$WO_ID"
if [ -n "$WO_ID" ]; then
  test_get "/api/crm/work-orders/$WO_ID"
  test_get "/api/crm/work-orders/$WO_ID/milestones"
fi

# contract id
CT_ID=$(curl -s "$BASE/api/crm/contracts" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.contracts&&x.contracts[0])console.log(x.contracts[0].id);})")
echo "CT_ID=$CT_ID"
if [ -n "$CT_ID" ]; then
  test_get "/api/crm/contracts/$CT_ID"
fi

# territory
TR_ID=$(curl -s "$BASE/api/crm/territories" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(Array.isArray(x)&&x[0])console.log(x[0].id);})")
echo "TR_ID=$TR_ID"
if [ -n "$TR_ID" ]; then
  test_get "/api/crm/territories/$TR_ID"
  test_get "/api/crm/territories/$TR_ID/pins"
fi

# subcontractor
SC_ID=$(curl -s "$BASE/api/crm/subcontractors" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.subcontractors&&x.subcontractors[0])console.log(x.subcontractors[0].id);})")
echo "SC_ID=$SC_ID"
if [ -n "$SC_ID" ]; then
  test_get "/api/crm/subcontractors/$SC_ID"
fi

# Prospect list
PL_ID=$(curl -s "$BASE/api/crm/prospect-lists" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.lists&&x.lists[0])console.log(x.lists[0].id);})")
echo "PL_ID=$PL_ID"
if [ -n "$PL_ID" ]; then
  test_get "/api/crm/prospect-lists/$PL_ID/items"
fi

# county status
CTY_ID=$(curl -s "$BASE/api/counties" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(Array.isArray(x)&&x[0])console.log(x[0].id);})")
echo "CTY_ID=$CTY_ID"
if [ -n "$CTY_ID" ]; then
  test_get "/api/counties/$CTY_ID/status"
fi

# Admin tenant detail
TEN_ID=$(curl -s "$BASE/api/admin/tenants" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(Array.isArray(x)&&x[0])console.log(x[0].id);})")
echo "TEN_ID=$TEN_ID"
if [ -n "$TEN_ID" ]; then
  test_get "/api/admin/tenants/$TEN_ID"
fi

# Reports
test_get "/api/crm/reports/revenue?startDate=2026-01-01&endDate=2026-12-31"
