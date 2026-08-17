// Fetch a public share token for the customer-facing estimate/contract pages.
// READ-ONLY: one login + GETs. No writes.
const API = 'http://localhost:3001';
const login = await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const lj = await login.json();
const tok = lj.accessToken;
if (!tok) { console.log('LOGIN FAILED', JSON.stringify(lj).slice(0, 300)); process.exit(1); }
const H = { Authorization: 'Bearer ' + tok };

const est = await (await fetch(API + '/api/crm/estimates?limit=100', { headers: H })).json();
const rows = est.estimates || est.data || est.rows || (Array.isArray(est) ? est : []);
console.log('estimates returned:', rows.length);
if (rows[0]) console.log('FIELDS:', Object.keys(rows[0]).join(','));
const tokenField = rows[0] ? Object.keys(rows[0]).filter(k => /token|share|public|slug/i.test(k)) : [];
console.log('token-ish fields:', JSON.stringify(tokenField));
const withTok = rows.filter(r => tokenField.some(f => r[f]));
console.log('rows WITH a token:', withTok.length);
for (const r of withTok.slice(0, 5)) {
  console.log(JSON.stringify({ id: r.id, num: r.estimate_number, status: r.status, ...Object.fromEntries(tokenField.map(f => [f, r[f]])) }));
}

const con = await (await fetch(API + '/api/crm/contracts?limit=50', { headers: H })).json();
const crows = con.contracts || con.data || (Array.isArray(con) ? con : []);
console.log('contracts returned:', crows.length);
if (crows[0]) {
  const cf = Object.keys(crows[0]).filter(k => /token|share|public|slug/i.test(k));
  console.log('contract token fields:', JSON.stringify(cf));
  for (const r of crows.filter(r => cf.some(f => r[f])).slice(0, 3))
    console.log(JSON.stringify({ id: r.id, num: r.contract_number, ...Object.fromEntries(cf.map(f => [f, r[f]])) }));
}
