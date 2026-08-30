import pool from './src/db/pool.js';
const T = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;
const today = new Date().toISOString().slice(0, 10);
for (const t of ['tasks','leads','estimates','invoices','contracts','work_orders','expenses','subcontractors','activities','notifications','custom_field_definitions']) {
  try {
    const r = await pool.query(`SELECT count(*)::int c,
      count(*) FILTER (WHERE created_at::date = $2)::int today_new,
      count(*) FILTER (WHERE updated_at::date = $2)::int today_upd
      FROM ${t} WHERE tenant_id=$1`, [T, today]);
    const x = r.rows[0];
    console.log(`${t.padEnd(26)} total=${String(x.c).padEnd(5)} created_today=${x.today_new}  updated_today=${x.today_upd}`);
  } catch (e) { console.log(`${t.padEnd(26)} ERR ${e.code}`); }
}
await pool.end();
