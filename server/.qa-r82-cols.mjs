import pool from './src/db/pool.js';
for (const t of ['leads','estimates']) {
  const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
  console.log('###', t, ':', r.rows.map(x=>x.column_name).join(', '));
}
await pool.end();
