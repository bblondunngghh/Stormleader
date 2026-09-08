import fs from 'fs';
import pool from './src/db/pool.js';
const sql = fs.readFileSync('./src/db/migrations/051_lead_summary_view_tenant_scope.sql','utf8');
const live = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lead_summary_view' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
const liveDef = (await pool.query(`SELECT pg_get_viewdef('lead_summary_view'::regclass,true) AS d`)).rows[0].d;
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(sql);
  const after = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lead_summary_view' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
  const afterDef = (await c.query(`SELECT pg_get_viewdef('lead_summary_view'::regclass,true) AS d`)).rows[0].d;
  console.log('columns live=%d  after051=%d', live.length, after.length);
  console.log('COLUMN LIST IDENTICAL :', JSON.stringify(live)===JSON.stringify(after));
  console.log('VIEW BODY IDENTICAL   :', liveDef.trim()===afterDef.trim());
  const miss = live.filter(x=>!after.includes(x)), extra = after.filter(x=>!live.includes(x));
  if(miss.length) console.log('  dropped by 051:', miss.join(', '));
  if(extra.length) console.log('  added by 051  :', extra.join(', '));
  await c.query('ROLLBACK');
  console.log('ROLLED BACK - no persistent write');
} catch(e){ await c.query('ROLLBACK'); console.log('ERROR:', e.message); }
finally { c.release(); await pool.end(); }
