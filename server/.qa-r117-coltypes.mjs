// Run 117 s1 — READ-ONLY: pg types for every whitelisted PATCH field.
import fs from 'fs';
import pool from './src/db/pool.js';
const TABLES = ['leads','tasks','estimates','invoices','work_orders','contracts','expenses',
  'subcontractors','storm_alert_configs','alert_configs','notification_preferences','custom_field_definitions'];
const q = await pool.query(`
  SELECT table_name, column_name, data_type, udt_name, is_nullable
  FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1)
  ORDER BY table_name, ordinal_position`, [TABLES]);
const byTable = {};
for (const r of q.rows) (byTable[r.table_name] ||= {})[r.column_name] = r.udt_name;
console.log('tables found:', Object.keys(byTable).join(', '));
console.log('MISSING:', TABLES.filter(t=>!byTable[t]).join(', ') || '(none)');
for (const [t,cols] of Object.entries(byTable)) {
  const interesting = Object.entries(cols).filter(([c,u])=>u!=='text' || false);
  console.log('\n['+t+'] '+Object.entries(cols).map(([c,u])=>c+':'+u).join(' '));
}
fs.writeFileSync('C:/tmp/qa-r117-coltypes.json', JSON.stringify(byTable,null,1));
await pool.end();
