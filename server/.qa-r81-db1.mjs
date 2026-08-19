import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql, p=[]) => { try { const r = await pool.query(sql,p); return r.rows; } catch(e){ return [{ERR:e.code+' '+e.message}]; } };
const out = {};
out.priorityCol = await q(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='priority'`);
out.enumVals = await q(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='lead_priority' ORDER BY e.enumsortorder`);
out.taskCount = await q(`SELECT count(*)::int AS n, count(due_date)::int AS with_due FROM tasks`);
out.taskPriorities = await q(`SELECT priority, count(*)::int FROM tasks GROUP BY 1`);
// automations present?
out.automations = await q(`SELECT id, name, trigger_type, action_type, action_config, is_active FROM automations LIMIT 20`);
out.contracts = await q(`SELECT count(*)::int AS n FROM contracts`);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
