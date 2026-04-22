#!/bin/bash
source /tmp/token.env
BASE=http://localhost:3001

test_req() {
  local method="$1"
  local path="$2"
  local body="$3"
  local status resp
  if [ -z "$body" ]; then
    status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" --max-time 20)
  else
    status=$(curl -s -o /tmp/resp-$$ -w "%{http_code}" -X "$method" "$BASE$path" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$body" --max-time 20)
  fi
  resp=$(cat /tmp/resp-$$ 2>/dev/null | head -c 300)
  rm -f /tmp/resp-$$
  printf "%s %s %s\n  -> %s\n" "$status" "$method" "$path" "$resp"
}

echo "=== Valid POST/PATCH tests ==="

# Create a lead (quick)
test_req POST /api/crm/leads/quick '{"address":"777 QA Test Rd","contactName":"QA Happy","priority":"warm"}'
# Get the newly created lead
NEW_LEAD=$(curl -s -X POST "$BASE/api/crm/leads/quick" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"address":"888 QA Path","contactName":"QA HappyPath","priority":"warm"}' | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).id)}catch{}})")
echo "NEW_LEAD=$NEW_LEAD"

if [ -n "$NEW_LEAD" ]; then
  test_req PATCH /api/crm/leads/$NEW_LEAD '{"priority":"hot","stage":"contacted"}'
  test_req POST /api/crm/leads/$NEW_LEAD/score ''
  test_req POST /api/crm/leads/$NEW_LEAD/contacts '{"name":"Secondary","phone":"5551111111","role":"spouse"}'
  test_req POST /api/crm/activities "{\"leadId\":\"$NEW_LEAD\",\"type\":\"call\",\"notes\":\"QA happy path test\"}"
  # Create task
  test_req POST /api/crm/tasks "{\"title\":\"QA task test\",\"leadId\":\"$NEW_LEAD\",\"dueDate\":\"2026-05-01\",\"priority\":\"warm\"}"
  # Create a canvass pin
  test_req POST /api/crm/canvass-pins "{\"lat\":30.27,\"lng\":-97.74,\"address\":\"888 QA Path\",\"outcome\":\"not_home\"}"
fi

# Create a task without lead
test_req POST /api/crm/tasks '{"title":"QA standalone task","dueDate":"2026-05-02","priority":"cold"}'

# Create an automation
test_req POST /api/crm/automations '{"name":"QA Automation","trigger_type":"lead_created","conditions":{},"actions":[{"type":"send_email","template":"welcome"}],"enabled":false}'

# Create a custom field
test_req POST /api/crm/custom-fields '{"name":"QA Field","field_type":"text","entity_type":"lead"}'

# Create a prospect list
test_req POST /api/crm/prospect-lists '{"name":"QA Prospects"}'

# Create a subcontractor
test_req POST /api/crm/subcontractors '{"name":"QA Sub","phone":"5559991111","specialty":"roofing"}'

# Create a territory
test_req POST /api/crm/territories '{"name":"QA Territory","color":"oklch(0.5 0.15 200)","polygon":[[-97.9,30.1],[-97.3,30.1],[-97.3,30.6],[-97.9,30.6],[-97.9,30.1]]}'

# Send a test notification
test_req PATCH /api/notifications/preferences '{"notification_type":"lead_assigned","in_app":true,"email":false}'

# Work Order create
if [ -n "$NEW_LEAD" ]; then
  test_req POST /api/crm/work-orders "{\"leadId\":\"$NEW_LEAD\",\"title\":\"QA WO\",\"description\":\"test\"}"
fi

# Estimate create
if [ -n "$NEW_LEAD" ]; then
  test_req POST /api/estimates "{\"leadId\":\"$NEW_LEAD\",\"customer_name\":\"QA Happy\",\"line_items\":[{\"quantity\":1,\"unit_price\":100,\"description\":\"test\"}]}"
fi

# Generate leads from storm - get storm first
STORM_ID=$(curl -s "$BASE/api/storms" -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>{const x=JSON.parse(d);if(x.features&&x.features[0])console.log(x.features[0].id);})")
echo "STORM_ID=$STORM_ID"
if [ -n "$STORM_ID" ]; then
  test_req POST /api/drift/$STORM_ID/correct ''
fi

# Test score-all, bulk ops (already tested)
echo ""
echo "=== Valid error cases ==="

# Bulk assign/status with valid structure
test_req POST /api/crm/leads/bulk-assign '{"leadIds":[],"userId":null}'
test_req POST /api/crm/leads/bulk-status '{"leadIds":[],"stage":"new"}'

# Cleanup: we don't delete for now, will be reviewed below
