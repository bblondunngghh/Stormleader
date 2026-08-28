// Run 103 s4-verify — CHECK 1: regression-test 29c009a (custom_fields type guard)
// Zero new rows. One identity merge ({}), which leaves the stored value byte-identical.
import fs from 'fs';

const API = 'http://localhost:3001';

async function login() {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: 'waterloo',
    }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + r.status + ' ' + JSON.stringify(j).slice(0, 300));
  fs.writeFileSync('C:/tmp/qa-token.txt', j.accessToken);
  return j.accessToken;
}

let TOKEN = null;
try {
  TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
  const probe = await fetch(API + '/api/crm/leads?limit=1', { headers: { authorization: 'Bearer ' + TOKEN } });
  if (probe.status === 401) TOKEN = await login();
} catch { TOKEN = await login(); }

const H = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' };

// pick a real lead
const lr = await fetch(API + '/api/crm/leads?limit=5', { headers: H });
const lj = await lr.json();
const leads = Array.isArray(lj) ? lj : (lj.leads || lj.data || []);
if (!leads.length) throw new Error('no leads: ' + JSON.stringify(lj).slice(0, 300));
const lead = leads[0];
const id = lead.id;

const before = await (await fetch(API + `/api/crm/leads/${id}`, { headers: H })).json();
const beforeCF = JSON.stringify((before.lead || before).custom_fields);

const BAD = [
  ['string', '"a-string"'],
  ['number', '42'],
  ['boolean', 'true'],
  ['array', '["x"]'],
  ['null', 'null'],
  ['array-of-object', '[{"k":"v"}]'],
];

const out = { leadId: id, beforeCF, bad: [], good: null, afterCF: null, verdict: null };

for (const [name, raw] of BAD) {
  const r = await fetch(API + `/api/crm/leads/${id}`, {
    method: 'PATCH', headers: H, body: `{"custom_fields": ${raw}}`,
  });
  let body = '';
  try { body = JSON.stringify(await r.json()).slice(0, 120); } catch {}
  out.bad.push({ name, status: r.status, ok: r.status === 400, body });
}

// positive control: identity merge — `x || '{}'` is a value-preserving no-op
const gr = await fetch(API + `/api/crm/leads/${id}`, {
  method: 'PATCH', headers: H, body: JSON.stringify({ custom_fields: {} }),
});
out.good = { status: gr.status, ok: gr.status === 200 };

const after = await (await fetch(API + `/api/crm/leads/${id}`, { headers: H })).json();
out.afterCF = JSON.stringify((after.lead || after).custom_fields);
out.unchanged = out.afterCF === beforeCF;

// app-wide: does ANY lead hold a non-object custom_fields?
const allr = await fetch(API + '/api/crm/leads?limit=200', { headers: H });
const allj = await allr.json();
const all = Array.isArray(allj) ? allj : (allj.leads || allj.data || []);
out.totalLeads = all.length;
out.corrupted = all
  .filter(l => l.custom_fields !== null && l.custom_fields !== undefined &&
               (typeof l.custom_fields !== 'object' || Array.isArray(l.custom_fields)))
  .map(l => ({ id: l.id, cf: JSON.stringify(l.custom_fields).slice(0, 80) }));

out.verdict = out.bad.every(b => b.ok) && out.good.ok && out.unchanged && out.corrupted.length === 0
  ? 'PASS' : 'FAIL';

console.log(JSON.stringify(out, null, 2));
