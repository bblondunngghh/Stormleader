// Run 88 — do write routes return 400 or 500 when handed an out-of-range ENUM value?
// A Postgres 22P02 (invalid_text_representation) surfacing as a 500 is the defect shape.
// Every probe below is expected to be REJECTED; nothing should be stored.
const BASE = process.argv[2] || 'http://localhost:3098';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'waterlooconstruction1@gmail.com',
    password: '2Wealth&health',
    tenantSlug: 'waterloo',
  }),
});
const auth = await login.json();
if (!auth.accessToken) { console.log('LOGIN FAILED', login.status); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` };

const api = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let j = null;
  try { j = await r.json(); } catch { /* no body */ }
  return { status: r.status, body: j };
};

const leads = await api('GET', '/api/crm/leads?limit=1');
const leadId = (leads.body?.leads || leads.body || [])[0]?.id;
console.log('leadId', leadId, '\n');

// [label, method, path, body] — each carries exactly ONE out-of-range enum value.
const PROBES = [
  ['tasks.priority (create)', 'POST', '/api/crm/tasks', { title: 'QA-R88 enum probe', priority: 'urgent' }],
  ['tasks.priority legacy medium', 'POST', '/api/crm/tasks', { title: 'QA-R88 enum probe', priority: 'medium' }],
  ['tasks.status (create)', 'POST', '/api/crm/tasks', { title: 'QA-R88 enum probe', status: 'not_a_status' }],
  ['leads.stage', 'PATCH', `/api/crm/leads/${leadId}`, { stage: 'not_a_stage' }],
  ['leads.priority', 'PATCH', `/api/crm/leads/${leadId}`, { priority: 'urgent' }],
  ['leads.status', 'PATCH', `/api/crm/leads/${leadId}`, { status: 'not_a_status' }],
];

const created = [];
for (const [label, method, path, body] of PROBES) {
  const r = await api(method, path, body);
  const is5xx = r.status >= 500;
  const msg = typeof r.body?.error === 'string' ? r.body.error.slice(0, 90) : JSON.stringify(r.body || {}).slice(0, 90);
  console.log(`${is5xx ? 'DEFECT' : '  ok  '}  ${String(r.status).padEnd(4)} ${label.padEnd(30)} ${msg}`);
  if (r.status === 200 || r.status === 201) created.push([label, r.body?.id, r.body?.priority ?? r.body?.status ?? r.body?.stage]);
}

if (created.length) {
  console.log('\nACCEPTED (stored, needs review):');
  for (const c of created) console.log('  ', c.join('  '));
}
