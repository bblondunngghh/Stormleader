import fs from 'node:fs';
import http from 'node:http';
const TOKEN = fs.readFileSync('.qa-token.txt','utf8').trim();
function r(p) {
  return new Promise(resolve => {
    http.get({hostname:'localhost',port:3001,path:p,headers:{Authorization:'Bearer '+TOKEN}}, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({s:res.statusCode,b:d.slice(0,200)}));
    }).on('error',e=>resolve({s:0,b:e.message}));
  });
}
// Endpoints that pass limit/offset to a DB query
const paths = [
  '/api/crm/leads',
  '/api/crm/tasks',
  '/api/crm/leads/00000000-0000-0000-0000-000000000001/activities',
  '/api/estimates',
  '/api/crm/expenses',
  '/api/crm/invoices',
  '/api/crm/contracts',
  '/api/crm/work-orders',
  '/api/crm/canvass-pins',
  '/api/crm/automations',
  '/api/notifications',
  '/api/alerts/history',
  '/api/documents',
  '/api/dashboard/activity',
  '/api/storms',
  '/api/storm-history',
  '/api/properties',
  '/api/crm/prospect-lists',
  '/api/skip-trace/usage',
  '/api/skip-trace/jobs',
  '/api/skip-trace/invoices',
  '/api/payments/history',
];
const broken = [];
for (const p of paths) {
  const [neg1, off1] = await Promise.all([r(p+'?limit=-1'), r(p+'?offset=-50')]);
  if (neg1.s >= 500 || off1.s >= 500) {
    broken.push({path: p, limit_neg: neg1.s, offset_neg: off1.s, limit_body: neg1.b, offset_body: off1.b});
    console.log(`🔥 ${p}: limit=-1 → ${neg1.s} | offset=-50 → ${off1.s}`);
  }
}
console.log(`\nBroken: ${broken.length}/${paths.length}`);
fs.writeFileSync('.qa-pagination-broken.json', JSON.stringify(broken, null, 2));
