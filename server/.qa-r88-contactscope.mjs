// Run 88 — regression probe for DELETE /api/crm/leads/:leadId/contacts/:contactId
// Asserts the delete is scoped to the OWNING lead, not just the tenant.
// Net DB writes: 1 contact created, 1 deleted => 0.
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
if (!auth.accessToken) {
  console.log('LOGIN FAILED', login.status, JSON.stringify(auth).slice(0, 200));
  process.exit(1);
}
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` };

const api = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let j = null;
  try { j = await r.json(); } catch { /* empty body */ }
  return { status: r.status, body: j };
};

const results = [];
const assert = (name, cond, detail) => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// Two distinct leads in the same tenant
const leads = await api('GET', '/api/crm/leads?limit=2');
const rows = leads.body?.leads || leads.body?.data || leads.body || [];
if (!Array.isArray(rows) || rows.length < 2) {
  console.log('SETUP FAILED — need 2 leads, got', Array.isArray(rows) ? rows.length : typeof rows);
  process.exit(1);
}
const leadA = rows[0].id;
const leadB = rows[1].id;
console.log('leadA', leadA, '\nleadB', leadB);

// Create a throwaway contact on lead A
const created = await api('POST', `/api/crm/leads/${leadA}/contacts`, {
  first_name: 'QA-R88',
  last_name: 'ScopeProbe',
  email: 'qa-r88@example.invalid',
});
assert('POST contact on leadA returns 201', created.status === 201, `status=${created.status}`);
const contactId = created.body?.id;
if (!contactId) {
  console.log('SETUP FAILED — no contact id', JSON.stringify(created.body).slice(0, 300));
  process.exit(1);
}
console.log('contact', contactId);

const contactsOf = async (leadId) => {
  const d = await api('GET', `/api/crm/leads/${leadId}`);
  const c = d.body?.contacts || [];
  return c.map((x) => x.id);
};

assert('contact is listed under leadA', (await contactsOf(leadA)).includes(contactId));

// THE DEFECT: delete through a lead that does NOT own the contact
const wrong = await api('DELETE', `/api/crm/leads/${leadB}/contacts/${contactId}`);
assert('DELETE via non-owning lead returns 404', wrong.status === 404, `status=${wrong.status}`);
const survived = (await contactsOf(leadA)).includes(contactId);
assert(
  'contact SURVIVES a delete via non-owning lead',
  survived,
  survived ? 'row still present' : 'ROW WAS DELETED THROUGH THE WRONG LEAD'
);

// The legitimate path still works
const right = await api('DELETE', `/api/crm/leads/${leadA}/contacts/${contactId}`);
assert('DELETE via owning lead returns 200', right.status === 200, `status=${right.status}`);
assert('contact is gone after owning-lead delete', !(await contactsOf(leadA)).includes(contactId));

// Idempotency: second delete 404s
const again = await api('DELETE', `/api/crm/leads/${leadA}/contacts/${contactId}`);
assert('repeat DELETE returns 404', again.status === 404, `status=${again.status}`);

// Validation still holds
const badLead = await api('DELETE', `/api/crm/leads/not-a-uuid/contacts/${contactId}`);
assert('DELETE with malformed leadId returns 400', badLead.status === 400, `status=${badLead.status}`);
const badContact = await api('DELETE', `/api/crm/leads/${leadA}/contacts/not-a-uuid`);
assert('DELETE with malformed contactId returns 400', badContact.status === 400, `status=${badContact.status}`);

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
