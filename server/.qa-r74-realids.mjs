// Run 74 s1 — REAL-ID GET sweep. Read-only: GET only, no mutations.
// Rationale: the dead-uuid sweep 404s before reaching handler logic, so it is
// structurally incapable of finding stored-shape crashes (see 46d8480).
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';

async function mint() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  return (await r.json()).accessToken;
}
let token = await mint();

const one = async (sql, params = []) => {
  try { return (await pool.query(sql, params)).rows[0]?.id ?? null; }
  catch (e) { console.log('  resolver skip:', e.message); return null; }
};
const ids = {
  contract:     await one(`SELECT id FROM contracts WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  dripseq:      await one(`SELECT id FROM drip_sequences WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  financingApp: await one(`SELECT id FROM financing_applications WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  invoice:      await one(`SELECT id FROM invoices WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  lead:         await one(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  prospectList: await one(`SELECT id FROM prospect_lists WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  subcontractor:await one(`SELECT id FROM subcontractors WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  territory:    await one(`SELECT id FROM territories WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  workOrder:    await one(`SELECT id FROM work_orders WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  estimate:     await one(`SELECT id FROM estimates WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  materialOrder:await one(`SELECT id FROM material_orders WHERE tenant_id=$1 LIMIT 1`, [TENANT]),
  property:     await one(`SELECT id FROM properties LIMIT 1`),
  storm:        await one(`SELECT id FROM storm_events WHERE geom IS NOT NULL LIMIT 1`),
  county:       await one(`SELECT id FROM county_data_sources LIMIT 1`),
};
console.log('resolved ids:', Object.entries(ids).map(([k, v]) => `${k}=${v ? 'Y' : 'NULL'}`).join(' '));

const ROUTES = [
  ['/api/counties/:id/status', ids.county],
  ['/api/crm/contracts/:id', ids.contract],
  ['/api/crm/contracts/:id/pdf', ids.contract],
  ['/api/crm/drip-sequences/:id', ids.dripseq],
  ['/api/crm/financing/applications/:id', ids.financingApp],
  ['/api/crm/invoices/:id', ids.invoice],
  ['/api/crm/leads/:id', ids.lead],
  ['/api/crm/prospect-lists/:id/items', ids.prospectList],
  ['/api/crm/subcontractors/:id', ids.subcontractor],
  ['/api/crm/territories/:id', ids.territory],
  ['/api/crm/territories/:id/pins', ids.territory],
  ['/api/crm/work-orders/:id', ids.workOrder],
  ['/api/crm/work-orders/:id/milestones', ids.workOrder],
  ['/api/crm/work-orders/:id/pdf', ids.workOrder],
  ['/api/drift/:stormEventId', ids.storm],
  ['/api/estimates/:id', ids.estimate],
  ['/api/estimates/:id/pdf', ids.estimate],
  ['/api/leads/:id', ids.lead],
  ['/api/materials/orders/:id', ids.materialOrder],
  ['/api/properties/:id', ids.property],
  ['/api/properties/:id/report/pdf', ids.property],
  ['/api/properties/:id/weather-history', ids.property],
  ['/api/properties/:id/weather-history/pdf', ids.property],
  ['/api/storms/:id', ids.storm],
  ['/api/crm/expenses/summary/:leadId', ids.lead],
  ['/api/crm/leads/:id/activities', ids.lead],
  ['/api/crm/subcontractors/work-order/:workOrderId', ids.workOrder],
  ['/api/materials/products/:id', '1'],
];

async function get(path) {
  try {
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000) });
    const t = await r.text();
    return { status: r.status, body: t.slice(0, 300) };
  } catch (e) { return { status: 0, body: 'FETCH_ERR ' + e.message }; }
}

console.log('\n=== PHASE 4: single real id per param GET route ===');
const phase4 = [];
for (const [tpl, id] of ROUTES) {
  if (!id) { console.log('SKIP (no row)', tpl); continue; }
  const path = tpl.replace(/:[A-Za-z_]+/g, String(id));
  const res = await get(path);
  phase4.push({ tpl, path, ...res });
  if (res.status >= 500 || res.status === 0) console.log(`  ${res.status} ${tpl} -> ${res.body.slice(0, 200)}`);
}
console.log(`swept ${phase4.length}; 5xx = ${phase4.filter(r => r.status >= 500 || r.status === 0).length}`);
console.log('tally:', JSON.stringify(phase4.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {})));

// ---- PHASE 5: EVERY row of every JSONB-bearing entity through detail + PDF ----
console.log('\n=== PHASE 5: exhaustive per-row sweep of JSONB-bearing entities ===');
const ENTITIES = [
  ['estimates',       `SELECT id FROM estimates WHERE tenant_id=$1`,       ['/api/estimates/ID', '/api/estimates/ID/pdf']],
  ['invoices',        `SELECT id FROM invoices WHERE tenant_id=$1`,        ['/api/crm/invoices/ID']],
  ['contracts',       `SELECT id FROM contracts WHERE tenant_id=$1`,       ['/api/crm/contracts/ID', '/api/crm/contracts/ID/pdf']],
  ['work_orders',     `SELECT id FROM work_orders WHERE tenant_id=$1`,     ['/api/crm/work-orders/ID', '/api/crm/work-orders/ID/pdf']],
  ['material_orders', `SELECT id FROM material_orders WHERE tenant_id=$1`, ['/api/materials/orders/ID']],
  ['leads',           `SELECT id FROM leads WHERE tenant_id=$1`,           ['/api/crm/leads/ID']],
];
const phase5 = [];
let count = 0;
for (const [name, sql, tpls] of ENTITIES) {
  const { rows } = await pool.query(sql, [TENANT]);
  let bad = 0;
  for (const row of rows) {
    for (const tpl of tpls) {
      if (++count % 100 === 0) token = await mint();
      const path = tpl.replace('ID', row.id);
      const res = await get(path);
      if (res.status >= 500 || res.status === 0) {
        bad++;
        phase5.push({ entity: name, path, ...res });
        console.log(`  ${res.status} ${path} -> ${res.body.slice(0, 160)}`);
      }
    }
  }
  console.log(`${name}: ${rows.length} rows x ${tpls.length} route(s) = ${rows.length * tpls.length} reqs, 5xx=${bad}`);
}
console.log(`\nPHASE 5 total requests: ${count}, total 5xx: ${phase5.length}`);
fs.writeFileSync('C:/tmp/r74-realid.json', JSON.stringify({ ids, phase4, phase5 }, null, 1));
await pool.end();
