import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql, p=[]) => { try { const r = await pool.query(sql,p); return r.rows; } catch(e){ return [{ERR:e.message}]; } };
const out = {};
out.property = await q("SELECT id, address, city, state, zip, latitude, longitude FROM properties LIMIT 2");
out.tables = await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
console.log(JSON.stringify(out, null, 1));
process.exit(0);
