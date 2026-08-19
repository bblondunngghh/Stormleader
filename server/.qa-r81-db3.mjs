import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql, p=[]) => { try { const r = await pool.query(sql,p); return r.rows; } catch(e){ return [{ERR:e.code+' '+e.message.split('\n')[0]}]; } };
const out = {};
out.dripSeq = await q(`SELECT count(*)::int n FROM drip_sequences`);
out.dripSteps = await q(`SELECT id, step_type, step_config FROM drip_sequence_steps WHERE step_type='create_task' LIMIT 10`);
out.stepTables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%drip%'`);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
