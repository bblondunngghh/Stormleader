// R69 s1 — Run 68's lesson operationalised: a 2xx is NOT evidence the stored value is usable.
// Write a non-string into a text field, READ IT BACK, and report the stored type.
import fs from 'fs';
const BASE = 'http://localhost:3001';

let TOKEN;
async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  TOKEN = (await r.json()).accessToken;
}
await login();

async function req(method, path, body) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
}

const SHAPES = {
  number: 12345,
  boolean: true,
  array: ['a', 'b'],
  object: { a: 1 },
};

const results = [];
const created = [];

// --- POST /api/crm/leads/quick : contact_name + source (both in the R66 ACCEPTED backlog,
//     both consumed by a string method behind a truthy-only guard in the client) ---
for (const field of ['contact_name', 'source']) {
  for (const [shape, val] of Object.entries(SHAPES)) {
    const body = { address: '1 QA Probe Way', city: 'Austin', state: 'TX', zip: '78701' };
    body[field] = val;
    const c = await req('POST', '/api/crm/leads/quick', body);
    const id = c.json && (c.json.id || (c.json.lead && c.json.lead.id));
    let stored = null, storedType = null, readStatus = null;
    if (id) {
      created.push(id);
      const g = await req('GET', '/api/crm/leads/' + id);
      readStatus = g.status;
      const lead = g.json && (g.json.lead || g.json);
      if (lead) { stored = lead[field]; storedType = Array.isArray(stored) ? 'array' : typeof stored; }
    }
    // Would a client string-method call survive this stored value?
    const method = field === 'contact_name' ? 'split' : 'replace';
    const truthy = !!stored && stored !== '—';
    const crashes = truthy && typeof stored?.[method] !== 'function';
    results.push({ route: 'POST /crm/leads/quick', field, shape, createStatus: c.status, readStatus, storedType, stored: JSON.stringify(stored), truthy, crashes });
    console.log(
      [field.padEnd(13), shape.padEnd(8), 'create=' + c.status, 'storedType=' + String(storedType).padEnd(7),
        'stored=' + JSON.stringify(stored), crashes ? '  *** CLIENT WOULD CRASH (.' + method + ') ***' : ''].join(' ')
    );
  }
}

console.log('\ncleaning up ' + created.length + ' probe leads...');
let del = 0;
for (const id of created) {
  const d = await req('DELETE', '/api/crm/leads/' + id);
  if (d.status < 300) del++; else console.log('  DELETE ' + id + ' -> ' + d.status + ' ' + d.text.slice(0, 80));
}
console.log('deleted ' + del + '/' + created.length);

fs.writeFileSync('C:/tmp/qa-r69-stored.json', JSON.stringify({ results, created, deleted: del }, null, 1));
const bad = results.filter(r => r.crashes);
console.log('\n=== ' + bad.length + ' stored values that would crash a client string call ===');
for (const b of bad) console.log('  ' + b.field + ' as ' + b.shape + ' -> stored ' + b.storedType + ' ' + b.stored);
