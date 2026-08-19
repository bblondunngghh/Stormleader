import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql, p=[]) => { try { const r = await pool.query(sql,p); return r.rows; } catch(e){ return [{ERR:e.message}]; } };
const out = {};
out.upd = await q("UPDATE contracts SET status='draft' WHERE id='bb979c43-4371-460b-b6fc-db8a7b730451' AND status='voided' RETURNING id, status");
out.all = await q("SELECT status, count(*) FROM contracts GROUP BY 1 ORDER BY 1");
console.log(JSON.stringify(out, null, 1));
process.exit(0);
