import 'dotenv/config';
import pool from './src/db/pool.js';
const c = await pool.connect();
const out = {};
const tenant = (await c.query(`SELECT id FROM tenants LIMIT 1`)).rows[0].id;
for (const p of ['medium','low','high','urgent','hot','warm','cold']) {
  await c.query('BEGIN');
  try {
    await c.query(
      `INSERT INTO tasks (tenant_id, lead_id, title, priority, due_date) VALUES ($1,$2,$3,$4,$5)`,
      [tenant, null, 'QA r81 rollback probe', p, null]
    );
    out[p] = 'ACCEPTED';
  } catch (e) { out[p] = e.code + ' ' + e.message.split('\n')[0]; }
  await c.query('ROLLBACK');
}
out.finalTaskCount = (await c.query(`SELECT count(*)::int n FROM tasks`)).rows[0].n;
c.release();
console.log(JSON.stringify(out, null, 1));
process.exit(0);
