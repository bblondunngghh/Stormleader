import pool from './src/db/pool.js';
const { rows: pre } = await pool.query(
  `SELECT id, estimate_number, created_at FROM estimates
   WHERE created_at > NOW() - INTERVAL '20 minutes' ORDER BY created_at`);
console.log('estimates created in last 20 min (QA residue):', pre.length);
pre.forEach(r=>console.log('  ',r.estimate_number, r.created_at.toISOString()));
if (pre.length) await pool.query('DELETE FROM estimates WHERE id = ANY($1::uuid[])', [pre.map(r=>r.id)]);
const { rows:[c] } = await pool.query('SELECT COUNT(*)::int n FROM estimates');
console.log('deleted', pre.length, '| estimates now:', c.n, '(baseline 84)');
const { rows: bad } = await pool.query(
  `SELECT estimate_number FROM estimates WHERE id IN
   ('1252940b-b691-4182-8d4f-680ac71a0711','2dd4659c-ed16-4353-9ee6-5dfdf944f365')`);
console.log('malformed fixtures still present (must be 2):', bad.map(r=>r.estimate_number).join(','));
await pool.end();
