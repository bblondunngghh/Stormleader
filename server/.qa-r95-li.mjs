import pool from './src/db/pool.js';
const {rows}=await pool.query(`SELECT jsonb_typeof(line_items) AS jty, line_items::text AS raw, count(*)::int n FROM work_orders GROUP BY 1,2 ORDER BY n DESC LIMIT 10`);
console.log('work_orders line_items distribution:');
for(const r of rows) console.log(`  jsonb_typeof=${r.jty} n=${r.n} raw=${String(r.raw).slice(0,80)}`);
// what does pg return for {} vs [] and does a round-trip through JS preserve it?
const {rows:[x]}=await pool.query(`SELECT '{}'::jsonb a, '[]'::jsonb b`);
console.log('pg->JS  {} =>', JSON.stringify(x.a), typeof x.a, Array.isArray(x.a), ' [] =>', JSON.stringify(x.b), Array.isArray(x.b));
await pool.end();
