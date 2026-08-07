// R69 s1 — full GET sweep with real ids resolved from list endpoints.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// JWT TTL is 15m — mint our own rather than trusting a token file.
let TOKEN = null;
async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 200));
  TOKEN = j.accessToken;
  fs.writeFileSync('C:/tmp/qa-token.txt', TOKEN);
  return TOKEN;
}
await login();

async function req(method, path, body) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const r = await fetch(BASE + path, opts);
    const ct = r.headers.get('content-type') || '';
    let text = '';
    if (ct.includes('application/json')) text = await r.text();
    else text = '<' + ct.split(';')[0] + ' ' + (r.headers.get('content-length') || '?') + 'b>';
    return { status: r.status, ct, text };
  } catch (e) {
    return { status: 0, ct: '', text: 'FETCH_ERR ' + e.message };
  }
}

function pick(o) {
  // pull first id-ish array out of a list response
  if (Array.isArray(o)) return o;
  if (!o || typeof o !== 'object') return [];
  for (const k of ['data', 'items', 'rows', 'results', 'leads', 'estimates', 'invoices',
    'contracts', 'workOrders', 'work_orders', 'subcontractors', 'territories', 'expenses',
    'sequences', 'products', 'orders', 'properties', 'storms', 'tenants', 'applications',
    'templates', 'lists', 'segments']) {
    if (Array.isArray(o[k])) return o[k];
  }
  for (const v of Object.values(o)) if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
  return [];
}

async function firstId(listPath, key = 'id') {
  const r = await req('GET', listPath);
  if (r.status !== 200) return null;
  let j; try { j = JSON.parse(r.text); } catch { return null; }
  const arr = pick(j);
  if (!arr.length) return null;
  return arr[0][key] ?? arr[0].id ?? null;
}

const ids = {};
console.log('resolving real ids...');
ids.leadId = await firstId('/api/crm/leads?limit=1');
ids.estimateId = await firstId('/api/estimates?limit=1');
ids.contractId = await firstId('/api/crm/contracts?limit=1');
ids.invoiceId = await firstId('/api/crm/invoices?limit=1');
ids.workOrderId = await firstId('/api/crm/work-orders?limit=1');
ids.subcontractorId = await firstId('/api/crm/subcontractors?limit=1');
ids.territoryId = await firstId('/api/crm/territories?limit=1');
ids.propertyId = await firstId('/api/properties?limit=1');
ids.stormEventId = await firstId('/api/storms?limit=1', 'event_id');
ids.productId = await firstId('/api/materials/products?limit=1');
ids.orderId = await firstId('/api/materials/orders?limit=1');
ids.sequenceId = await firstId('/api/crm/drip-sequences?limit=1');
ids.contactId = await firstId('/api/crm/contacts?limit=1');
ids.listId = await firstId('/api/crm/prospect-lists?limit=1');
ids.countyId = await firstId('/api/counties?limit=1');
ids.appId = await firstId('/api/crm/financing/applications?limit=1');
console.log(JSON.stringify(ids, null, 1));

// map a :param inside a specific path to the right real id
function resolve(path) {
  let p = path;
  const seg = (name, val) => { if (val != null) p = p.split(':' + name).join(String(val)); };
  seg('leadId', ids.leadId);
  seg('estimateId', ids.estimateId);
  seg('workOrderId', ids.workOrderId);
  seg('woId', ids.workOrderId);
  seg('subcontractorId', ids.subcontractorId);
  seg('propertyId', ids.propertyId);
  seg('stormEventId', ids.stormEventId);
  seg('contactId', ids.contactId);
  seg('jobId', '00000000-0000-0000-0000-000000000000');
  seg('userId', '00000000-0000-0000-0000-000000000000');
  seg('milestoneId', '00000000-0000-0000-0000-000000000000');
  seg('token', 'qa-nonexistent-token');
  if (p.includes(':id')) {
    let v = null;
    if (p.startsWith('/api/crm/contracts')) v = ids.contractId;
    else if (p.startsWith('/api/crm/invoices')) v = ids.invoiceId;
    else if (p.startsWith('/api/crm/work-orders')) v = ids.workOrderId;
    else if (p.startsWith('/api/crm/subcontractors')) v = ids.subcontractorId;
    else if (p.startsWith('/api/crm/territories')) v = ids.territoryId;
    else if (p.startsWith('/api/crm/drip-sequences')) v = ids.sequenceId;
    else if (p.startsWith('/api/crm/prospect-lists')) v = ids.listId;
    else if (p.startsWith('/api/crm/financing')) v = ids.appId;
    else if (p.startsWith('/api/crm/leads')) v = ids.leadId;
    else if (p.startsWith('/api/estimates')) v = ids.estimateId;
    else if (p.startsWith('/api/leads')) v = ids.leadId;
    else if (p.startsWith('/api/materials/products')) v = ids.productId;
    else if (p.startsWith('/api/materials/orders')) v = ids.orderId;
    else if (p.startsWith('/api/properties')) v = ids.propertyId;
    else if (p.startsWith('/api/storms')) v = ids.stormEventId;
    else if (p.startsWith('/api/counties')) v = ids.countyId;
    else if (p.startsWith('/api/admin/tenants')) v = '791bb51d-3293-4839-92e9-bd4d4f873af2';
    if (v != null) p = p.split(':id').join(String(v));
  }
  return p;
}

const gets = inv.filter(r => r.method === 'GET');
const out = [];
for (const r of gets) {
  const p = resolve(r.path);
  const unresolved = p.includes(':');
  const res = await req('GET', p);
  out.push({ file: r.file, path: r.path, actual: p, unresolved, status: res.status, ct: res.ct.split(';')[0], body: res.text.slice(0, 300) });
  if (res.status >= 500 || res.status === 0) console.log('!!! ' + res.status + ' ' + p + ' :: ' + res.text.slice(0, 200));
}

fs.writeFileSync('C:/tmp/qa-r70-getsweep.json', JSON.stringify({ ids, out }, null, 1));
const byStatus = {};
for (const o of out) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
console.log('\n=== GET sweep: ' + out.length + ' routes ===');
console.log(JSON.stringify(byStatus));
console.log('5xx/0:', out.filter(o => o.status >= 500 || o.status === 0).length);
console.log('unresolved params:', out.filter(o => o.unresolved).map(o => o.path).join(', '));
