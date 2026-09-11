// Run 130 (s1 api-test) — read-only reconnaissance for the contract UPDATE-boundary probe.
// Answers three questions before anything is planted:
//   1. does the caller tenant own a DRAFT contract (updateContract requires status='draft')?
//   2. what are the NOT NULL columns on `estimates` (so the fixture INSERT is minimal)?
//   3. current row counts, for the net-zero assertion at teardown.
import pool from './src/db/pool.js';

const CALLER = '791bb51d-3293-4839-92e9-bd4d4f873af2';  // waterloo
const FOREIGN = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34'; // waterloo-roofco-2

const out = {};

const { rows: drafts } = await pool.query(
  `SELECT id, status, lead_id, estimate_id, template_type FROM contracts
   WHERE tenant_id = $1 ORDER BY status = 'draft' DESC, created_at DESC LIMIT 6`,
  [CALLER]
);
out.callerContracts = drafts;

const { rows: cols } = await pool.query(
  `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'estimates' AND is_nullable = 'NO'
   ORDER BY ordinal_position`
);
out.estimatesNotNull = cols;

const { rows: counts } = await pool.query(
  `SELECT
     (SELECT count(*) FROM estimates)  AS estimates,
     (SELECT count(*) FROM contracts)  AS contracts,
     (SELECT count(*) FROM estimates WHERE tenant_id = $1) AS foreign_estimates`,
  [FOREIGN]
);
out.counts = counts[0];

const { rows: tenants } = await pool.query(
  `SELECT id, slug, name FROM tenants ORDER BY created_at LIMIT 10`
);
out.tenants = tenants;

console.log(JSON.stringify(out, null, 2));
await pool.end();
