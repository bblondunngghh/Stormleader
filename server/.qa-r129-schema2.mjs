import pool from './src/db/pool.js';
for (const t of ['invoices','contracts','estimates']) {
  const { rows } = await pool.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name=$1 AND column_name='lead_id'`, [t]);
  const { rows: c } = await pool.query(`SELECT count(*) FILTER (WHERE lead_id IS NULL) AS null_lead, count(*) AS total FROM ${t}`);
  console.log(t, 'nullable=' + (rows[0]?.is_nullable), 'null_lead=' + c[0].null_lead, 'total=' + c[0].total);
}
await pool.end();
