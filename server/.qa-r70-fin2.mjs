import pool from './src/db/pool.js';
const { rows: l } = await pool.query('SELECT id, provider, is_active FROM financing_lenders');
console.log('LENDERS:', JSON.stringify(l));
const { rows: p } = await pool.query(
  `SELECT fp.id, fp.name, fp.is_active, fl.provider
   FROM financing_plans fp JOIN financing_lenders fl ON fl.id=fp.lender_id ORDER BY fl.provider`);
console.log('PLANS:'); p.forEach(r=>console.log('  ', r.provider, '|', r.id, '|', r.name, '| active', r.is_active));
const { rows: e } = await pool.query(
  `SELECT id, estimate_number, public_token, financing_enabled, financing_plan_ids, tenant_id
   FROM estimates WHERE financing_enabled = true`);
console.log('FINANCING-ENABLED ESTIMATE:', JSON.stringify(e, null, 1));
await pool.end();
