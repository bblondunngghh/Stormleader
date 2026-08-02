import pool from './src/db/pool.js';
const MINE = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const tables = ['leads','contracts','estimates','invoices','work_orders','expenses',
  'subcontractors','territories','canvass_pins','tasks','documents','contract_templates',
  'automations','drip_sequences','properties','notifications','activities','users'];
const out = {};
for (const t of tables) {
  try {
    const { rows } = await pool.query(
      `SELECT id, tenant_id FROM ${t} WHERE tenant_id IS NOT NULL AND tenant_id <> $1 LIMIT 2`, [MINE]);
    if (rows.length) out[t] = rows;
    else {
      const c = await pool.query(`SELECT count(*)::int n FROM ${t}`);
      out[t] = `no-foreign-rows (total=${c.rows[0].n})`;
    }
  } catch (e) { out[t] = 'ERR: ' + e.message.split('\n')[0].slice(0,90); }
}
console.log(JSON.stringify(out, null, 1));
await pool.end();
