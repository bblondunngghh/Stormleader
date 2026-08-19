// Run 79 s1 pass 1 — validation sweep: every write route with an EMPTY body and REAL ids.
// Structural limit: this proves nothing 500s on missing input. It cannot find bugs in the
// stored-value path (Run 74 lesson) — pass 2 does that with real payloads.
import fs from 'node:fs';
const API = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r79-ids.json', 'utf8')).ids;
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const DEAD = '00000000-0000-0000-0000-000000000000';

const SKIP = [
  /properties\/trigger-import/, /counties\/:id\/import/, /properties\/generate-leads/,
  /leads\/score-all/, /drift\/correct-all/, /roof-measurement\/measure/,
  /onboarding\/create-tenant/, /auth\/register/, /auth\/login/,
];

function idFor(param, p) {
  switch (param) {
    case 'leadId': return IDS.lead;
    case 'estimateId': return IDS.estimate;
    case 'propertyId': return p.includes('prospect-lists') ? IDS.prospectItemProperty : IDS.property;
    case 'workOrderId': case 'woId': return IDS.workOrder;
    case 'milestoneId': return IDS.milestone;
    case 'subcontractorId': return IDS.subcontractor;
    case 'contactId': return IDS.leadContact;
    case 'jobId': return IDS.skipTraceJob;
    case 'stormEventId': return IDS.stormEvent;
    case 'userId': return IDS.teamUser;
    case 'token': return null;
    case 'id':
      if (p.startsWith('/api/admin/tenants')) return IDS.tenant;
      if (p.startsWith('/api/crm/automations')) return IDS.automation;
      if (p.startsWith('/api/crm/contracts/templates')) return IDS.contractTemplate;
      if (p.startsWith('/api/crm/contracts')) return IDS.contract;
      if (p.startsWith('/api/crm/custom-fields')) return IDS.customField;
      if (p.startsWith('/api/crm/drip-sequences')) return IDS.dripSequence;
      if (p.startsWith('/api/crm/expenses')) return IDS.expense;
      if (p.startsWith('/api/crm/financing/lenders')) return IDS.lender;
      if (p.startsWith('/api/crm/financing/plans')) return IDS.plan;
      if (p.startsWith('/api/crm/invoices')) return IDS.invoice;
      if (p.startsWith('/api/crm/leads')) return IDS.lead;
      if (p.startsWith('/api/crm/prospect-lists')) return IDS.prospectList;
      if (p.startsWith('/api/crm/subcontractors')) return IDS.subcontractor;
      if (p.startsWith('/api/crm/tasks')) return IDS.task;
      if (p.startsWith('/api/crm/territories')) return IDS.territory;
      if (p.startsWith('/api/crm/work-orders')) return IDS.workOrder;
      if (p.startsWith('/api/crm/canvass-pins')) return IDS.canvassPin;
      if (p.startsWith('/api/counties')) return IDS.county;
      if (p.startsWith('/api/documents')) return IDS.document;
      if (p.startsWith('/api/estimates/templates')) return IDS.estimateTemplate;
      if (p.startsWith('/api/estimates')) return IDS.estimate;
      if (p.startsWith('/api/leads')) return IDS.lead;
      if (p.startsWith('/api/materials/orders')) return IDS.materialOrder;
      if (p.startsWith('/api/notifications')) return IDS.notification;
      if (p.startsWith('/api/properties')) return IDS.property;
      return null;
    default: return null;
  }
}

const results = [];
const writes = routes.filter(r => r.method !== 'GET');
for (const r of writes) {
  if (SKIP.some(rx => rx.test(r.path))) { results.push({ ...r, status: -1, body: 'SKIPPED (bulk/paid/irreversible)' }); continue; }
  let url = r.path, note = [];
  const params = [...r.path.matchAll(/:([A-Za-z]+)/g)].map(m => m[1]);
  const isDelete = r.method === 'DELETE';
  for (const p of params) {
    // DELETE never gets a real id in this pass — it would destroy user data
    const v = isDelete ? null : idFor(p, r.path);
    if (v) url = url.replace(':' + p, encodeURIComponent(v));
    else { note.push('no-real-' + p); url = url.replace(':' + p, p === 'token' ? 'qa-nonexistent-token' : DEAD); }
  }
  const t0 = Date.now();
  let out;
  try {
    const resp = await fetch(API + url, {
      method: r.method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const txt = await resp.text();
    out = { status: resp.status, ms: Date.now() - t0, body: txt.slice(0, 300) };
  } catch (e) { out = { status: 0, ms: Date.now() - t0, body: 'FETCH-ERR ' + e.message }; }
  results.push({ ...r, url, note: note.join(','), ...out });
}
fs.writeFileSync('C:/tmp/qa-r79-write1.json', JSON.stringify(results, null, 1));
const by = {};
for (const x of results) by[x.status] = (by[x.status] || 0) + 1;
console.log('write routes swept:', writes.length, JSON.stringify(by));
console.log('--- 5xx / fetch errors ---');
for (const x of results.filter(v => v.status >= 500 || v.status === 0)) console.log(x.status, x.method, x.path, x.body.slice(0, 220));
console.log('--- 2xx on EMPTY BODY (candidate: accepts junk) ---');
for (const x of results.filter(v => v.status >= 200 && v.status < 300)) console.log(x.status, x.method, x.path, x.body.slice(0, 140));
