import 'dotenv/config';
import pool from './src/db/pool.js';
import { createSequence, enrollLead, processScheduledSteps, deleteSequence } from './src/services/dripService.js';

const out = {};
const tenant = (await pool.query(`SELECT tenant_id AS id FROM leads WHERE deleted_at IS NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`)).rows[0].id;
const lead = (await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL LIMIT 1`,[tenant])).rows[0].id;
out.baseline = (await pool.query(`SELECT (SELECT count(*)::int FROM tasks) t, (SELECT count(*)::int FROM drip_sequences) s, (SELECT count(*)::int FROM drip_enrollments) e`)).rows[0];

// delay_days 0 => next_run_at = now => immediately due. The drip UI offers NO priority
// field, so action_config has no priority at all -- the exact real-world shape.
const seq = await createSequence(tenant, {
  name: 'QA r81 drip', trigger_type: 'manual', is_active: true,
  steps: [{ delay_days: 0, action_type: 'create_task', action_config: { title: 'QA r81 DRIP' } }],
});
await enrollLead(tenant, seq.id, lead);
await pool.query(`UPDATE drip_enrollments SET next_run_at = NOW() - interval '1 minute' WHERE sequence_id=$1`, [seq.id]);
await processScheduledSteps();

out.created = (await pool.query(`SELECT title, priority::text FROM tasks WHERE title LIKE 'QA r81%'`)).rows;

// cleanup
out.tasksDeleted = (await pool.query(`DELETE FROM tasks WHERE title LIKE 'QA r81%'`)).rowCount;
await pool.query(`DELETE FROM drip_enrollments WHERE sequence_id=$1`, [seq.id]);
await deleteSequence(tenant, seq.id);
out.final = (await pool.query(`SELECT (SELECT count(*)::int FROM tasks) t, (SELECT count(*)::int FROM drip_sequences) s, (SELECT count(*)::int FROM drip_enrollments) e`)).rows[0];
console.log(JSON.stringify(out, null, 1));
process.exit(0);
