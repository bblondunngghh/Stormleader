import pool from './src/db/pool.js';
const q=async(s,p)=>(await pool.query(s,p)).rows;
const W=(await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
console.log('waterloo',W);
console.log('tenants:',JSON.stringify(await q(`SELECT t.slug, count(l.id)::int leads FROM tenants t LEFT JOIN leads l ON l.tenant_id=t.id GROUP BY t.slug ORDER BY 2 DESC`)));
console.log('foreign leads sample:',JSON.stringify(await q(`SELECT id,tenant_id,contact_name,address FROM leads WHERE tenant_id<>$1 LIMIT 3`,[W])));
console.log('waterloo counts:',JSON.stringify(await q(`SELECT (SELECT count(*)::int FROM leads WHERE tenant_id=$1) leads,(SELECT count(*)::int FROM tasks WHERE tenant_id=$1) tasks,(SELECT count(*)::int FROM estimates WHERE tenant_id=$1) est,(SELECT count(*)::int FROM invoices WHERE tenant_id=$1) inv,(SELECT count(*)::int FROM contracts WHERE tenant_id=$1) con,(SELECT count(*)::int FROM work_orders WHERE tenant_id=$1) wo,(SELECT count(*)::int FROM expenses WHERE tenant_id=$1) exp`,[W])));
await pool.end();
