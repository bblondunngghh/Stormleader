// Deep negative-case probes — query params, dates, pagination, enum violations.
// Catches handlers that don't sanitize query strings or trust input types.
import fs from 'node:fs';
import http from 'node:http';

const TOKEN = fs.readFileSync('.qa-token.txt','utf8').trim();
function req(method, path, body) {
  return new Promise(resolve => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {Authorization:'Bearer '+TOKEN};
    if (payload) { headers['Content-Type']='application/json'; headers['Content-Length']=payload.length; }
    const r = http.request({hostname:'localhost',port:3001,path,method,headers,timeout:15000}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({s:res.statusCode,b:d.slice(0,400)}));
    });
    r.on('error',e=>resolve({s:0,b:'ERR:'+e.message}));
    r.on('timeout',()=>{r.destroy();resolve({s:0,b:'TIMEOUT'});});
    if(payload)r.write(payload);
    r.end();
  });
}

const probes = [
  // Query param fuzzing on common list endpoints
  ['GET','/api/crm/leads?stage=invalid_stage'],
  ['GET','/api/crm/leads?limit=NaN&offset=NaN'],
  ['GET','/api/crm/leads?limit=-1'],
  ['GET','/api/crm/leads?limit=999999'],
  ['GET','/api/crm/leads?sort_by=DROP TABLE leads'],
  ['GET','/api/crm/leads?created_after=not-a-date'],
  ['GET','/api/crm/leads?score_min=abc'],
  ['GET','/api/crm/tasks?status=invalid'],
  ['GET','/api/crm/tasks?priority=nuclear'],
  ['GET','/api/crm/calendar?start=invalid&end=invalid'],
  ['GET','/api/crm/calendar?start=2026-01-01'],  // missing end
  ['GET','/api/crm/calendar'],  // missing both
  ['GET','/api/crm/canvass-pins/stats?days=foo'],
  ['GET','/api/storms?from=invalid'],
  ['GET','/api/storm-history?lat=abc&lng=def'],
  ['GET','/api/storm-history/heatmap?from=2099-99-99'],
  ['GET','/api/disaster-declarations?state=ZZ'],
  ['GET','/api/disaster-declarations?fromDate=invalid'],
  ['GET','/api/search?q='],          // empty query
  ['GET','/api/search'],             // no query at all
  ['GET','/api/properties?bbox=garbage'],
  ['GET','/api/properties?bbox=1,2,3'],   // wrong arity
  ['GET','/api/map/properties?bbox=invalid'],
  ['GET','/api/map/affected-properties?stormEventId=not-a-uuid'],
  ['GET','/api/map/swaths?from=invalid'],
  ['GET','/api/crm/invoices?status=invalid'],
  ['GET','/api/crm/invoices?from=invalid&to=invalid'],
  ['GET','/api/estimates?status=invalid'],
  ['GET','/api/crm/contracts?status=invalid'],
  ['GET','/api/crm/work-orders?status=invalid'],
  ['GET','/api/crm/expenses?leadId=not-uuid'],
  ['GET','/api/crm/reports/revenue?from=invalid'],
  ['GET','/api/crm/reports/conversion?from=invalid&to=invalid'],
  ['GET','/api/crm/reports/stage-duration'],
  ['GET','/api/crm/reports/rep-performance'],
  ['GET','/api/crm/reports/lead-sources'],
  ['GET','/api/crm/dashboard/conversion-by-storm?from=invalid'],
  ['GET','/api/crm/dashboard/lead-source-revenue?from=invalid&to=invalid'],
  ['GET','/api/dashboard/stats?from=invalid'],
  ['GET','/api/dashboard/funnel?from=invalid'],
  ['GET','/api/dashboard/activity?limit=abc'],
  ['GET','/api/properties/reverse-geocode?lat=abc&lng=def'],
  ['GET','/api/properties/reverse-geocode'],  // missing
  ['GET','/api/data/fema-housing?state=ZZ'],
  ['GET','/api/data/directions?origin=invalid'],
  ['GET','/api/data/directions'],  // missing required
  ['GET','/api/admin/usage?from=invalid'],
  ['GET','/api/admin/revenue?from=invalid'],
  ['GET','/api/notifications?limit=NaN'],
  ['GET','/api/crm/leads?ids=not-uuid,also-not-uuid'],
  ['GET','/api/crm/canvass-pins?bbox=invalid'],
  ['GET','/api/crm/canvass-pins?stormEventId=not-uuid'],
  ['GET','/api/crm/leads/00000000-0000-0000-0000-000000000001/activities?type=invalid'],
  // POST/PATCH with malformed data types (should validate, not crash)
  ['POST','/api/crm/leads/quick',{firstName:1234,lastName:[],address:{}}],
  ['POST','/api/crm/leads/quick',{firstName:'x',lastName:'y',address:'z',extraField:'evil'}],
  ['POST','/api/crm/tasks',{title:123, due_date:'invalid-date'}],
  ['POST','/api/crm/tasks',{title:'x', priority:'nuclear'}],
  ['POST','/api/crm/activities',{type:'invalid'}],
  ['PATCH','/api/crm/leads/00000000-0000-0000-0000-000000000001',{stage:'invalid_stage'}],
  ['PATCH','/api/crm/leads/00000000-0000-0000-0000-000000000001',{score:'not-a-number'}],
  ['POST','/api/crm/leads/bulk-status',{ids:'not-an-array'}],
  ['POST','/api/crm/leads/bulk-assign',{ids:[],userId:'00000000-0000-0000-0000-000000000001'}],
  ['POST','/api/crm/leads/bulk-status',{ids:['not-uuid'],status:'invalid'}],
  // Public token endpoints with invalid tokens
  ['GET','/api/estimates/public/invalid-token-xyz'],
  ['GET','/api/leads/status/public/invalid'],
  ['GET','/api/crm/contracts/public/invalid'],
  ['GET','/api/crm/financing/public/invalid/plans'],
  ['GET','/api/crm/financing/public/invalid/applications'],
  // POST with prototype pollution attempt
  ['POST','/api/crm/leads/quick',{__proto__:{polluted:true},firstName:'x'}],
  // Pagination edge cases
  ['GET','/api/crm/leads?offset=-50'],
  ['GET','/api/crm/leads?limit=0'],
];

const fives = [];
const odd = [];
for (const [m,p,b] of probes) {
  const r = await req(m, p, b);
  const tag = r.s >= 500 ? '🔥5XX' : r.s === 0 ? '⛔' : r.s >= 400 ? '⚠️' : '✓';
  if (r.s >= 500 || r.s === 0) {
    fives.push([m,p,r.s,r.b]);
    console.log(`${tag} ${m} ${p} → ${r.s} | ${r.b.slice(0,200)}`);
  } else if (r.s === 200 && b == null && (p.includes('invalid')||p.includes('NaN'))) {
    // accepted bad input → suspicious unless graceful
    odd.push([m,p,r.s,r.b.slice(0,120)]);
  }
}
console.log(`\nProbes: ${probes.length} | 5xx/conn: ${fives.length} | suspicious-200: ${odd.length}`);
if (odd.length) {
  console.log('\nSuspicious 200s (accepted invalid input):');
  for (const [m,p,s,b] of odd.slice(0,20)) console.log(`  ${m} ${p} → ${s} | ${b}`);
}
