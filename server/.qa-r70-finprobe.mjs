// R70 s1 — does the PUBLIC financing apply route enforce the plan list it advertises?
// getPublicPlans() restricts offers to estimate.financing_plan_ids, but
// createPublicApplication() forwards the caller's planId with only a
// tenant + is_active check (index.js:198). Same-tenant, active, NOT-OFFERED
// plans therefore look accepted. Verify empirically. Lenders are 'mock', so no
// outward call and no real credit application is created.
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOKEN = '2705acd173a54b0cf751ddbe8b8ba788ad498a48446649f803a9879a85d87002';
const EST_TENANT = '84d2b23c-2408-4cfb-a9d6-5a00c8f2f4b2';
const OFFERED = ['b27521fe-7ae1-4cf3-82e8-0517b15bf7f7', 'e2ed01d1-c459-47de-863d-7941be83d13f', '90cd1dc1-934b-4c4a-8e72-459a4532672d'];

// which plans are same-tenant but NOT offered on this estimate?
const { rows: plans } = await pool.query(
  'SELECT id, name, tenant_id, is_active FROM financing_plans WHERE tenant_id = $1', [EST_TENANT]);
console.log('plans owned by the estimate tenant: ' + plans.length);
const notOffered = plans.filter(p => !OFFERED.includes(p.id));
console.log('same-tenant but NOT offered on EST-001:');
notOffered.forEach(p => console.log('   ', p.id, p.name, 'active=' + p.is_active));

// other tenants' plans — control, must be rejected
const { rows: foreign } = await pool.query(
  'SELECT id, name, tenant_id FROM financing_plans WHERE tenant_id <> $1 LIMIT 1', [EST_TENANT]);

const post = async (planId) => {
  const r = await fetch(`${BASE}/api/crm/financing/public/${TOKEN}/apply`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId }),
  });
  return { status: r.status, text: (await r.text()).slice(0, 200) };
};

console.log('\n--- what the public endpoint ADVERTISES ---');
const adv = await fetch(`${BASE}/api/crm/financing/public/${TOKEN}/plans`);
const advJson = await adv.json();
console.log('GET /public/:token/plans ->', adv.status, 'count=' + (Array.isArray(advJson) ? advJson.length : '?'));
if (Array.isArray(advJson)) advJson.forEach(p => console.log('    offers:', p.id, p.name));

console.log('\n--- what the public endpoint ACCEPTS ---');
if (notOffered.length) {
  const target = notOffered[0];
  const res = await post(target.id);
  console.log(`NOT-OFFERED same-tenant plan (${target.name}) -> ${res.status} ${res.text.slice(0, 150)}`);
  console.log(res.status === 201 ? '  *** ACCEPTED — advertised list is NOT enforced ***'
                                 : '  rejected — list IS enforced');
} else console.log('no same-tenant non-offered plan available to test');

if (foreign.length) {
  const res = await post(foreign[0].id);
  console.log(`CONTROL foreign-tenant plan -> ${res.status} ${res.text.slice(0, 120)}`);
}
const res3 = await post('00000000-0000-0000-0000-0000000000ff');
console.log(`CONTROL nonexistent plan -> ${res3.status} ${res3.text.slice(0, 120)}`);

const { rows: after } = await pool.query(
  'SELECT id, plan_id, status, amount, customer_name FROM financing_applications ORDER BY created_at DESC');
console.log('\nfinancing_applications rows now: ' + after.length);
after.forEach(a => console.log('   ', a.id, 'plan=' + a.plan_id, a.status, a.amount, a.customer_name));
await pool.end();
