import pool from './src/db/pool.js';
const t='791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = async (label,sql)=>{ const r=await pool.query(sql,[t]); console.log(label, JSON.stringify(r.rows)); };
await q('leads total            ', `SELECT count(*) FROM leads WHERE tenant_id=$1`);
await q('leads deleted_at IS NULL', `SELECT count(*) FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL`);
await q('view rows              ', `SELECT count(*) FROM lead_summary_view WHERE tenant_id=$1 AND deleted_at IS NULL`);
await q('by stage (not deleted) ', `SELECT stage, count(*) FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY stage ORDER BY 2 DESC`);
await pool.end();
