import * as svc from './src/services/estimateService.js';
import pool from './src/db/pool.js';
const TENANT='791bb51d-3293-4839-92e9-bd4d4f873af2', USER='45cc729d-cc5b-44b5-93ca-7c01b427fc26';
const before = (await pool.query('SELECT COUNT(*)::int n FROM estimates')).rows[0].n;
const created = [];
for (const [label,id] of [['EST-083 [null]','1252940b-b691-4182-8d4f-680ac71a0711'],
                          ['EST-082 [null,"",1]','2dd4659c-ed16-4353-9ee6-5dfdf944f365'],
                          ['EST-081 (control, good data)', null]]) {
  let target = id;
  if (!target) { target = (await pool.query(
    `SELECT id FROM estimates WHERE jsonb_typeof(line_items)='array'
       AND jsonb_array_length(line_items) > 0 AND tenant_id=$1
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(line_items) e WHERE jsonb_typeof(e)<>'object')
     ORDER BY created_at DESC LIMIT 1`,[TENANT])).rows[0].id; }
  try {
    const r = await svc.generateTiers(TENANT, USER, target);
    const ids = (r||[]).map(t=>t.id||t.estimate?.id).filter(Boolean);
    created.push(...ids);
    console.log(label,'-> OK, tiers:', (r||[]).length, 'items in first tier:',
      JSON.stringify((r?.[0]?.line_items||r?.[0]?.estimate?.line_items||[]).length));
  } catch (e) { console.log(label,'-> STILL THROWS:', e.message); }
}
// cleanup: remove every estimate this verification created
if (created.length) {
  await pool.query('DELETE FROM estimates WHERE id = ANY($1::uuid[])', [created]);
}
const after = (await pool.query('SELECT COUNT(*)::int n FROM estimates')).rows[0].n;
console.log(`\nestimates before=${before} after=${after} (created ${created.length}, deleted ${created.length}) NET=${after-before}`);
await pool.end();
