import pool from './src/db/pool.js';
const A='791bb51d-3293-4839-92e9-bd4d4f873af2';
const { rows } = await pool.query(
  `SELECT estimate_number, line_items, subtotal FROM estimates
    WHERE tenant_id=$1 AND jsonb_typeof(line_items)='array' AND jsonb_array_length(line_items)>0
    ORDER BY estimate_number`,[A]);
const f = (li)=> (Array.isArray(li)?li:[]).filter(i=>i&&typeof i==='object');
let identity=0, changed=0;
for (const r of rows) {
  const before=r.line_items, after=f(before);
  if (after.length===before.length) identity++;
  else { changed++; console.log(`  ${r.estimate_number}: ${before.length} -> ${after.length}  dropped ${JSON.stringify(before.filter(i=>!(i&&typeof i==='object')))}  (stored subtotal ${r.subtotal})`); }
}
console.log(`\nestimates with >=1 line item: ${rows.length}`);
console.log(`filter is IDENTITY (nothing dropped): ${identity}`);
console.log(`filter DROPPED something:             ${changed}   <- exactly the crashing rows, nothing else`);
await pool.end();
