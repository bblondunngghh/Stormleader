import pool from './src/db/pool.js';
const L='8cd0f0f2-6296-412f-a5a8-96ae2c6f786e';
const q=async(l,s,p=[])=>{const r=await pool.query(s,p);console.log(l,JSON.stringify(r.rows).slice(0,400));return r;};
await q('peer leads cf   :',`SELECT custom_fields cf,count(*)::int n FROM leads WHERE id<>$1 GROUP BY 1`,[L]);
const cur=(await pool.query(`SELECT custom_fields,updated_at,created_at FROM leads WHERE id=$1`,[L])).rows[0];
console.log('BEFORE          :',JSON.stringify(cur.custom_fields));
// Original was COALESCE(custom_fields,'{}') = the array's first element. Restore exactly that.
if(JSON.stringify(cur.custom_fields)!=='[{},"a-string-not-an-object"]'){console.log('ABORT: not the state this run created');process.exit(0);}
const r=await q('REPAIRED        :',
  `UPDATE leads SET custom_fields='{}'::jsonb WHERE id=$1 AND custom_fields='[{},"a-string-not-an-object"]'::jsonb
   RETURNING id,custom_fields,jsonb_typeof(custom_fields) t`,[L]);
console.log('rowCount:',r.rowCount);
await q('junk cf remaining:',`SELECT count(*)::int n FROM leads WHERE custom_fields IS NOT NULL AND jsonb_typeof(custom_fields)<>'object'`);
await pool.end();
