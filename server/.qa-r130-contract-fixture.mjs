// Run 130 (s1 api-test) — foreign-tenant fixture for the contract UPDATE boundary.
//
// HYPOTHESIS: 96f7ad2 guarded the five CREATE paths that take a client-supplied FK, but
// never enumerated the matching UPDATE paths. `updateContract` (contractService.js:116)
// still whitelists `lead_id` and `estimate_id` with no ownership check, and `getContract`
// (:52) joins `estimates e ON e.id = c.estimate_id` with NO tenant predicate while
// selecting e.estimate_number and e.total. So a caller should be able to PATCH another
// tenant's estimate id onto their own draft contract and read that estimate's number and
// dollar total back.
//
// Plants ONE estimate + ONE lead in a non-caller tenant, attacks over the real HTTP API as
// `waterloo`, reads back, then removes everything it created. Net zero.
//
// Usage: node .qa-r130-contract-fixture.mjs            (attack + teardown)
//        node .qa-r130-contract-fixture.mjs --keep     (leave fixture rows for a re-probe)
import pool from './src/db/pool.js';
import fs from 'fs';

const API = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const CALLER = '791bb51d-3293-4839-92e9-bd4d4f873af2';  // waterloo (token tenant)
const FOREIGN = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34'; // waterloo-roofco-2
const KEEP = process.argv.includes('--keep');

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

const MARK_EST = 'ZZ-VICTIM-EST-9999';
const MARK_LEAD = 'ZZ-VICTIM-CONTACT';
const MARK_TOTAL = '987654.32';

const result = { steps: [], verdict: {} };
let estId = null;
let leadId = null;
let contractId = null;
let ownEstimateId = null;

const before = async () => (await pool.query(
  `SELECT (SELECT count(*) FROM estimates) e, (SELECT count(*) FROM leads) l,
          (SELECT count(*) FROM contracts) c`
)).rows[0];

try {
  result.counts_before = await before();

  // ---- a draft contract owned by the CALLER (updateContract requires status='draft')
  const { rows: drafts } = await pool.query(
    `SELECT id, estimate_id, lead_id FROM contracts
     WHERE tenant_id = $1 AND status = 'draft' ORDER BY created_at LIMIT 1`,
    [CALLER]
  );
  if (!drafts.length) throw new Error('caller tenant owns no draft contract');
  contractId = drafts[0].id;
  result.target = { contractId, original: drafts[0] };

  // ---- a real estimate the caller DOES own, for the positive-path control
  const { rows: own } = await pool.query(
    `SELECT id, estimate_number, total FROM estimates WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
    [CALLER]
  );
  ownEstimateId = own[0]?.id || null;
  result.ownEstimate = own[0] || null;

  // ---- plant the victim rows in the FOREIGN tenant
  const { rows: [est] } = await pool.query(
    `INSERT INTO estimates (tenant_id, estimate_number, status, subtotal, total, customer_name)
     VALUES ($1, $2, 'sent', $3, $3, 'Rival Customer') RETURNING id`,
    [FOREIGN, MARK_EST, MARK_TOTAL]
  );
  estId = est.id;

  const { rows: [lead] } = await pool.query(
    `INSERT INTO leads (tenant_id, address, contact_name, contact_email, stage)
     VALUES ($1, '999 SECRET STREET', $2, 'victim@rival.example', 'new') RETURNING id`,
    [FOREIGN, MARK_LEAD]
  );
  leadId = lead.id;
  result.steps.push({ step: 'plant', estId, leadId, contractId });

  // ---- ATTACK 1: PATCH a foreign estimate_id onto the caller's own draft contract
  const p1 = await fetch(`${API}/crm/contracts/${contractId}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ estimate_id: estId }),
  });
  const p1b = await j(p1);
  result.steps.push({
    step: 'PATCH /crm/contracts/:id {estimate_id: FOREIGN}',
    status: p1.status,
    stored: p1b?.estimate_id === estId,
    error: p1b?.error ?? null,
  });

  // ---- READ BACK: getContract joins estimates with no tenant predicate
  const g1 = await fetch(`${API}/crm/contracts/${contractId}`, { headers: H });
  const g1b = await j(g1);
  const blob1 = JSON.stringify(g1b);
  result.steps.push({
    step: 'GET /crm/contracts/:id  (after foreign estimate_id)',
    status: g1.status,
    LEAKED_estimate_number: blob1.includes(MARK_EST),
    LEAKED_estimate_total: blob1.includes(MARK_TOTAL),
    estimate_number: g1b?.estimate_number ?? null,
    estimate_total: g1b?.estimate_total ?? null,
  });

  // ---- ATTACK 2: the lead_id half of the same whitelist
  const p2 = await fetch(`${API}/crm/contracts/${contractId}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ lead_id: leadId }),
  });
  const p2b = await j(p2);
  result.steps.push({
    step: 'PATCH /crm/contracts/:id {lead_id: FOREIGN}',
    status: p2.status,
    stored: p2b?.lead_id === leadId,
    error: p2b?.error ?? null,
  });

  const g2 = await fetch(`${API}/crm/contracts/${contractId}`, { headers: H });
  const g2b = await j(g2);
  const blob2 = JSON.stringify(g2b);
  result.steps.push({
    step: 'GET /crm/contracts/:id  (after foreign lead_id)',
    status: g2.status,
    LEAKED_contact_name: blob2.includes(MARK_LEAD),
    LEAKED_address: blob2.includes('999 SECRET STREET'),
    note: 'leads join IS scoped (83ba6b4) — expect false; the defect here is the stored dangling FK',
  });

  // ---- confirm what actually sits in the row
  const { rows: [stored] } = await pool.query(
    'SELECT lead_id, estimate_id FROM contracts WHERE id = $1', [contractId]
  );
  result.steps.push({
    step: 'DB row after both PATCHes',
    stored,
    DANGLING_estimate_fk: stored.estimate_id === estId,
    DANGLING_lead_fk: stored.lead_id === leadId,
  });

  // ---- POSITIVE PATH: the caller's OWN estimate must still attach and still resolve
  if (ownEstimateId) {
    const p3 = await fetch(`${API}/crm/contracts/${contractId}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ estimate_id: ownEstimateId, lead_id: null }),
    });
    const p3b = await j(p3);
    const g3 = await fetch(`${API}/crm/contracts/${contractId}`, { headers: H });
    const g3b = await j(g3);
    result.steps.push({
      step: 'REGRESSION: PATCH own estimate_id, read back',
      patchStatus: p3.status,
      patchError: p3b?.error ?? null,
      getStatus: g3.status,
      estimate_number: g3b?.estimate_number ?? null,
      resolves: g3b?.estimate_number === result.ownEstimate?.estimate_number,
    });
  }

  // ---- ghost uuid control (must behave the same before and after the fix)
  const p4 = await fetch(`${API}/crm/contracts/${contractId}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ estimate_id: '00000000-0000-0000-0000-000000000000' }),
  });
  result.steps.push({ step: 'CONTROL: PATCH ghost estimate_id', status: p4.status, body: await j(p4) });

  const s = result.steps;
  result.verdict = {
    foreign_estimate_accepted: s[1]?.status === 200 && s[1]?.stored === true,
    foreign_estimate_pii_disclosed: s[2]?.LEAKED_estimate_number === true || s[2]?.LEAKED_estimate_total === true,
    foreign_lead_accepted: s[3]?.status === 200 && s[3]?.stored === true,
    foreign_lead_pii_disclosed: s[4]?.LEAKED_contact_name === true || s[4]?.LEAKED_address === true,
    own_estimate_still_works: s[6]?.resolves === true,
  };
} catch (e) {
  result.error = String(e?.stack || e);
} finally {
  // ---- TEARDOWN: restore the contract, drop the planted rows, assert net zero
  if (!KEEP) {
    if (contractId && result.target) {
      await pool.query('UPDATE contracts SET lead_id = $2, estimate_id = $3 WHERE id = $1',
        [contractId, result.target.original.lead_id, result.target.original.estimate_id]);
    }
    if (estId) await pool.query('DELETE FROM estimates WHERE id = $1', [estId]);
    if (leadId) await pool.query('DELETE FROM leads WHERE id = $1', [leadId]);
    result.counts_after = await before();
    const { rows: [restored] } = await pool.query(
      'SELECT lead_id, estimate_id FROM contracts WHERE id = $1', [contractId]);
    result.restored_row = restored;
    result.net_zero =
      result.counts_before.e === result.counts_after.e &&
      result.counts_before.l === result.counts_after.l &&
      result.counts_before.c === result.counts_after.c &&
      restored.lead_id === result.target.original.lead_id &&
      restored.estimate_id === result.target.original.estimate_id;
  } else {
    result.kept = { estId, leadId, contractId };
  }
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
