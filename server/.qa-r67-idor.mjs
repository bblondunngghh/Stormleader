// Run 67 — LIVE cross-tenant IDOR probe.
// Run 65 swept tenant isolation STATICALLY (read the SQL). This actually asks the
// running server for another tenant's rows, using a genuinely-signed token for
// tenant B and real row ids owned by tenant A.
// READ-ONLY: GET routes only, no writes.
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';

const BASE = process.env.QA_BASE || 'http://localhost:3098';
const SECRET = process.env.JWT_SECRET || 'qa-r67-known-secret';

const A = '791bb51d-3293-4839-92e9-bd4d4f873af2'; // waterloo — data-rich victim tenant
const B = 'e3961fce-802b-4c68-99c0-1f52bcaabe20'; // waterloo-roofco — attacker tenant

const users = await pool.query(`SELECT id, email, tenant_id, role FROM users WHERE tenant_id = ANY($1)`, [[A, B]]);
const ua = users.rows.find(u => u.tenant_id === A && u.role === 'admin');
const ub = users.rows.find(u => u.tenant_id === B);
if (!ua || !ub) { console.error('missing users', users.rows); process.exit(1); }

const mint = (u) => jwt.sign({ id: u.id, tenantId: u.tenant_id, email: u.email, role: u.role }, SECRET, { expiresIn: '1h' });
const tokA = mint(ua), tokB = mint(ub);
console.log(`attacker = ${ub.email} (tenant B ${B.slice(0,8)}, role ${ub.role})`);
console.log(`victim   = ${ua.email} (tenant A ${A.slice(0,8)}, role ${ua.role})\n`);

// one real row id per table, owned by tenant A
async function idFor(table, col = 'id') {
  try {
    const { rows } = await pool.query(`SELECT ${col} AS id FROM ${table} WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1`, [A]);
    return rows[0]?.id ?? null;
  } catch { return null; }
}

const ids = {};
for (const t of ['leads','contacts','estimates','invoices','tasks','work_orders','contracts','subcontractors',
                 'territories','drip_sequences','financing_applications','material_orders','prospect_lists',
                 'expenses','documents','properties','custom_field_definitions','skip_trace_usage','automations']) {
  ids[t] = await idFor(t);
}
console.log('tenant-A row ids resolved:', Object.entries(ids).filter(([,v])=>v).map(([k])=>k).join(', '));
console.log('NO row found (route skipped):', Object.entries(ids).filter(([,v])=>!v).map(([k])=>k).join(', ') || '(none)', '\n');

// route -> which table's id fills the param
const ROUTES = [
  ['/api/crm/leads/{leads}',                          'leads'],
  ['/api/crm/leads/{leads}/activities',               'leads'],
  ['/api/leads/{leads}',                              'leads'],
  ['/api/crm/expenses/summary/{leads}',               'leads'],
  ['/api/estimates/{estimates}',                      'estimates'],
  ['/api/estimates/{estimates}/pdf',                  'estimates'],
  ['/api/crm/invoices/{invoices}',                    'invoices'],
  ['/api/crm/contracts/{contracts}',                  'contracts'],
  ['/api/crm/contracts/{contracts}/pdf',              'contracts'],
  ['/api/crm/work-orders/{work_orders}',              'work_orders'],
  ['/api/crm/work-orders/{work_orders}/milestones',   'work_orders'],
  ['/api/crm/work-orders/{work_orders}/pdf',          'work_orders'],
  ['/api/crm/subcontractors/{subcontractors}',        'subcontractors'],
  ['/api/crm/subcontractors/work-order/{work_orders}','work_orders'],
  ['/api/crm/territories/{territories}',              'territories'],
  ['/api/crm/territories/{territories}/pins',         'territories'],
  ['/api/crm/drip-sequences/{drip_sequences}',        'drip_sequences'],
  ['/api/crm/drip-sequences/{drip_sequences}/enrollments','drip_sequences'],
  ['/api/crm/financing/applications/{financing_applications}','financing_applications'],
  ['/api/crm/prospect-lists/{prospect_lists}/items',  'prospect_lists'],
  ['/api/materials/orders/{material_orders}',         'material_orders'],
  ['/api/properties/{properties}',                    'properties'],
  ['/api/properties/{properties}/weather-history',    'properties'],
  ['/api/roof-measurement/segments/{properties}',     'properties'],
  ['/api/roof-measurement/solar/{properties}',        'properties'],
  ['/api/skip-trace/job/{skip_trace_usage}',          'skip_trace_usage'],
];

async function hit(path, tok) {
  const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tok}` } });
  let body = ''; try { body = (await r.text()).slice(0, 160); } catch {}
  return { status: r.status, body };
}

const results = [];
for (const [tpl, table] of ROUTES) {
  const id = ids[table];
  if (!id) { results.push({ path: tpl, table, skipped: 'no tenant-A row' }); continue; }
  const path = tpl.replace(/\{[^}]+\}/, id);
  const a = await hit(path, tokA);
  const b = await hit(path, tokB);
  // LEAK = tenant B got a 2xx on a row owned by tenant A
  const leak = b.status >= 200 && b.status < 300;
  results.push({ path, table, control_A: a.status, attacker_B: b.status, leak, bodyB: leak ? b.body : undefined });
}

console.log('='.repeat(96));
console.log('LIVE CROSS-TENANT IDOR PROBE — GET routes, real tenant-A ids, tenant-B token');
console.log('='.repeat(96));
console.log('ctrlA  attkB  verdict            route');
let leaks = 0, controlsOk = 0, skipped = 0;
for (const r of results) {
  if (r.skipped) { skipped++; console.log(`  --     --   SKIP (${r.skipped})  ${r.path}`); continue; }
  if (r.control_A >= 200 && r.control_A < 300) controlsOk++;
  if (r.leak) leaks++;
  const verdict = r.leak ? '*** LEAK ***     '
    : (r.control_A >= 200 && r.control_A < 300) ? 'ISOLATED         '
    : 'isolated (weak ctrl)';
  console.log(` ${String(r.control_A).padEnd(5)} ${String(r.attacker_B).padEnd(5)} ${verdict} ${r.path}`);
  if (r.leak) console.log(`         LEAKED BODY: ${r.bodyB}`);
}
console.log('='.repeat(96));
console.log(`routes probed: ${results.length - skipped}   skipped: ${skipped}`);
console.log(`controls returning 2xx (id real + route works): ${controlsOk}`);
console.log(`CROSS-TENANT LEAKS: ${leaks}`);
const fs = await import('fs');
fs.writeFileSync('C:/tmp/qa-r67-idor.json', JSON.stringify(results, null, 2));
await pool.end();
