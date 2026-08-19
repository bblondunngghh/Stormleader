import 'dotenv/config';
import pool from './src/db/pool.js';
import { fireTrigger } from './src/services/automationEngine.js';

const out = {};
const tenant = (await pool.query(`SELECT tenant_id AS id FROM leads WHERE deleted_at IS NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`)).rows[0].id;
const lead = (await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`,[tenant])).rows[0].id;
out.baselineTasks = (await pool.query(`SELECT count(*)::int n FROM tasks`)).rows[0].n;

// 3 automations: new UI value, a legacy value already saved in someone's config, and no priority at all.
const cases = [
  ['QA r81 new-vocab',  { title: 'QA r81 A', priority: 'hot' }],
  ['QA r81 legacy',     { title: 'QA r81 B', priority: 'medium' }],
  ['QA r81 no-priority',{ title: 'QA r81 C' }],
];
const autoIds = [];
for (const [name, cfg] of cases) {
  const r = await pool.query(
    `INSERT INTO automations (tenant_id, name, trigger_type, trigger_config, action_type, action_config, is_active)
     VALUES ($1,$2,'lead_created','{}'::jsonb,'create_task',$3,true) RETURNING id`,
    [tenant, name, JSON.stringify(cfg)]
  );
  autoIds.push(r.rows[0].id);
}

await fireTrigger(tenant, 'lead_created', { leadId: lead, source: 'manual' });

out.created = (await pool.query(
  `SELECT title, priority::text FROM tasks WHERE title LIKE 'QA r81%' ORDER BY title`
)).rows;

// cleanup
const del = await pool.query(`DELETE FROM tasks WHERE title LIKE 'QA r81%'`);
out.tasksDeleted = del.rowCount;
const delA = await pool.query(`DELETE FROM automations WHERE id = ANY($1)`, [autoIds]);
out.automationsDeleted = delA.rowCount;
out.finalTasks = (await pool.query(`SELECT count(*)::int n FROM tasks`)).rows[0].n;
out.finalAutomations = (await pool.query(`SELECT count(*)::int n FROM automations`)).rows[0].n;
console.log(JSON.stringify(out, null, 1));
process.exit(0);
