// Run 91 (s1-api-test) — execute the 4 GET handlers that NO sweep has ever reached.
//
// WHY: drip_sequences, prospect_lists and financing_applications all have ZERO rows,
// so every previous sweep 404'd in the ownership lookup BEFORE the handler body ran.
// Run 88's probe tried to fix this and FAILED — its create bodies were rejected 400
// ("At least one step is required" / "stormEventId is required"), so the gap survived.
//
// This closes it. Every row created here is removed before exit; net DB writes = 0.
//
// DB-COST NOTE: POST /api/crm/prospect-lists calls createProspectListFromSwath, which
// bulk-inserts one prospect_list_items row per property in the swath. That violates the
// no-bulk-write constraint on a Neon free tier, so the list is seeded with ONE item by
// SQL instead. The GET handler under test is identical either way.
import pool from './src/db/pool.js';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3001';
const TENANT_SLUG = 'waterloo';

let TOKEN = '';
try { TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim(); } catch { /* none */ }

const H = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` });

const api = async (method, path, body) => {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: H(), body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body: j };
};

// Re-mint only on a real 401 — POST /auth/login is rate limited to ~10 per 15 min.
const ensureAuth = async () => {
  const probe = await api('GET', '/api/crm/leads?limit=1');
  if (probe.status !== 401) return true;
  console.log('token expired -> re-minting (spends one rate-limit attempt)');
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: TENANT_SLUG,
    }),
  });
  const j = await r.json();
  if (!j.accessToken) { console.log('LOGIN FAILED', r.status, JSON.stringify(j).slice(0, 160)); return false; }
  TOKEN = j.accessToken;
  fs.writeFileSync('C:/tmp/qa-token.txt', TOKEN);
  return true;
};

if (!(await ensureAuth())) { await pool.end(); process.exit(1); }

const { rows: [tenant] } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [TENANT_SLUG]);
const TID = tenant.id;
const one = async (sql, params = []) => {
  try { const { rows } = await pool.query(sql, params); return rows[0] || null; } catch (e) {
    console.log('   SQL ERR:', String(e.message).slice(0, 120)); return null;
  }
};

const defects = [];
const record = (label, status, body) => {
  const flag = status >= 500 ? 'DEFECT' : '  ok  ';
  console.log(`  ${flag} ${status}  ${label}`);
  if (status >= 500) {
    console.log('        ', JSON.stringify(body || {}).slice(0, 400));
    defects.push({ label, status, body });
  }
};

// ============================================================
// 1. drip_sequences/:id  and  drip_sequences/:id/enrollments
// ============================================================
console.log('\n=== 1. drip_sequences (create via API with a VALID body) ===');
let seqId = null;
{
  const c = await api('POST', '/api/crm/drip-sequences', {
    name: 'QA-R91 probe sequence',
    trigger_type: 'lead_created',
    is_active: false,
    steps: [{ step_order: 1, delay_days: 1, action_type: 'send_email', action_config: { subject: 'QA', body: 'QA' } }],
  });
  console.log(`  POST /api/crm/drip-sequences -> ${c.status}`);
  if (c.status === 201 || c.status === 200) {
    seqId = c.body?.id || c.body?.sequence?.id;
    console.log('  id', seqId);
  } else {
    console.log('  body:', JSON.stringify(c.body || {}).slice(0, 250));
  }
}
if (seqId) {
  for (const p of [`/api/crm/drip-sequences/${seqId}`, `/api/crm/drip-sequences/${seqId}/enrollments`]) {
    const g = await api('GET', p);
    record(`GET ${p}`, g.status, g.body);
  }
  // PATCH + the enroll path are writes on a row we own and are about to delete.
  const pa = await api('PATCH', `/api/crm/drip-sequences/${seqId}`, { is_active: false, name: 'QA-R91 renamed' });
  record(`PATCH /api/crm/drip-sequences/${seqId}`, pa.status, pa.body);
}

// ============================================================
// 2. prospect-lists/:id/items   (seed 1 list + 1 item by SQL)
// ============================================================
console.log('\n=== 2. prospect_lists (seeded by SQL — API create is a bulk write) ===');
let listId = null;
{
  const prop = await one('SELECT id FROM properties LIMIT 1');
  const storm = await one('SELECT id FROM storm_events LIMIT 1');
  const l = await one(
    `INSERT INTO prospect_lists (tenant_id, name, storm_event_id, property_count)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [TID, 'QA-R91 probe list', storm?.id || null, prop ? 1 : 0]
  );
  listId = l?.id || null;
  console.log('  seeded list', listId, '| property', prop?.id || 'NONE');
  if (listId && prop) {
    await one('INSERT INTO prospect_list_items (list_id, property_id) VALUES ($1, $2) RETURNING id', [listId, prop.id]);
  }
}
if (listId) {
  const paths = [
    `/api/crm/prospect-lists/${listId}/items`,
    `/api/crm/prospect-lists/${listId}/items?limit=10&offset=0`,
    // every filter branch of the handler at crm.js:993 in one shot
    `/api/crm/prospect-lists/${listId}/items?value_min=1&value_max=999999999&year_min=1900&year_max=2030&roof_min=0&roof_max=99999&has_owner=true&has_phone=true&homestead=true&status=new&city=Waterloo&roof_type=shingle`,
    // non-numeric junk into the parseInt paths
    `/api/crm/prospect-lists/${listId}/items?limit=abc&offset=xyz`,
    `/api/crm/prospect-lists/${listId}/items?value_min=notanumber&year_min=notanumber`,
    '/api/crm/prospect-lists',
  ];
  for (const p of paths) {
    const g = await api('GET', p);
    record(`GET ${p.slice(0, 120)}`, g.status, g.body);
  }
}

// ============================================================
// 3. financing/applications/:id
// ============================================================
console.log('\n=== 3. financing_applications ===');
let appId = null;
let seededLender = null;
let seededPlan = null;
{
  const lead = await one('SELECT id FROM leads WHERE tenant_id = $1 LIMIT 1', [TID]);
  const est = await one('SELECT id FROM estimates WHERE tenant_id = $1 LIMIT 1', [TID]);
  let lender = await one('SELECT id FROM financing_lenders LIMIT 1');
  let plan = await one('SELECT id FROM financing_plans LIMIT 1');
  console.log('  existing lender:', lender?.id || 'NONE', '| plan:', plan?.id || 'NONE');

  if (!lender) {
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='financing_lenders'"
    );
    console.log('  financing_lenders cols:', cols.rows.map((r) => r.column_name).join(','));
  }
  if (!plan) {
    const cols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='financing_plans'"
    );
    console.log('  financing_plans cols:', cols.rows.map((r) => r.column_name).join(','));
  }

  if (lead && est && lender && plan) {
    const a = await one(
      `INSERT INTO financing_applications (tenant_id, estimate_id, lead_id, lender_id, plan_id, amount, status, customer_name)
       VALUES ($1,$2,$3,$4,$5,$6,'pending','QA-R91 probe') RETURNING id`,
      [TID, est.id, lead.id, lender.id, plan.id, 12345]
    );
    appId = a?.id || null;
    console.log('  seeded application', appId);
  } else {
    console.log('  SKIPPED — missing prerequisite row(s); cannot reach the handler without inventing a lender/plan');
  }
}
if (appId) {
  for (const p of [`/api/crm/financing/applications/${appId}`, '/api/crm/financing/applications']) {
    const g = await api('GET', p);
    record(`GET ${p}`, g.status, g.body);
  }
}

// ============================================================
// 4. CLEANUP — must return the DB to exactly its prior state
// ============================================================
console.log('\n=== cleanup ===');
if (seqId) {
  const d = await api('DELETE', `/api/crm/drip-sequences/${seqId}`);
  console.log(`  DELETE /api/crm/drip-sequences/${seqId} -> ${d.status}`);
}
if (listId) {
  const d = await api('DELETE', `/api/crm/prospect-lists/${listId}`);
  console.log(`  DELETE /api/crm/prospect-lists/${listId} -> ${d.status}`);
}
if (appId) await pool.query('DELETE FROM financing_applications WHERE id = $1', [appId]);
if (seededPlan) await pool.query('DELETE FROM financing_plans WHERE id = $1', [seededPlan]);
if (seededLender) await pool.query('DELETE FROM financing_lenders WHERE id = $1', [seededLender]);

// belt-and-braces: remove anything the API delete missed
await pool.query("DELETE FROM prospect_list_items WHERE list_id IN (SELECT id FROM prospect_lists WHERE name LIKE 'QA-R91%')");
await pool.query("DELETE FROM prospect_lists WHERE name LIKE 'QA-R91%'");
await pool.query("DELETE FROM drip_sequence_steps WHERE sequence_id IN (SELECT id FROM drip_sequences WHERE name LIKE 'QA-R91%')");
await pool.query("DELETE FROM drip_sequences WHERE name LIKE 'QA-R91%'");
await pool.query("DELETE FROM financing_applications WHERE customer_name LIKE 'QA-R91%'");

const counts = {};
for (const [t, col] of [['prospect_lists', 'name'], ['drip_sequences', 'name'], ['financing_applications', 'customer_name']]) {
  const r = await one(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} LIKE 'QA-R91%'`);
  counts[t] = r?.n;
}
const orphanItems = await one(
  'SELECT count(*)::int AS n FROM prospect_list_items i LEFT JOIN prospect_lists l ON l.id = i.list_id WHERE l.id IS NULL'
);
console.log('  QA-R91 rows remaining:', JSON.stringify(counts), '| orphan list items:', orphanItems?.n);

console.log(`\n5xx DEFECTS: ${defects.length}`);
for (const d of defects) console.log(`  ${d.status}  ${d.label}`);

await pool.end();
