// Run 92 (s3 ui-audit) — READ ONLY. Finds existing public share tokens so the
// public/unauthenticated pages (/estimate/:token, /contract/:token, /status/:token)
// can be UI-audited in the browser. Creates nothing, writes nothing.
import pool from './src/db/pool.js';
const q = async (s, p = []) => (await pool.query(s, p)).rows;

const out = {};

out.estimates = await q(
  `SELECT id, estimate_number, status, public_token
     FROM estimates
    WHERE public_token IS NOT NULL
    ORDER BY created_at DESC LIMIT 5`);

// contracts: discover the token column name rather than assuming it
const contractCols = await q(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name ILIKE '%token%'`);
out.contractTokenCols = contractCols.map(r => r.column_name);
if (contractCols.length) {
  const col = contractCols[0].column_name;
  out.contracts = await q(
    `SELECT id, status, ${col} AS token FROM contracts
      WHERE ${col} IS NOT NULL ORDER BY created_at DESC LIMIT 5`);
}

const leadCols = await q(
  `SELECT column_name FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name ILIKE '%token%'`);
out.leadTokenCols = leadCols.map(r => r.column_name);
if (leadCols.length) {
  const col = leadCols[0].column_name;
  out.leads = await q(
    `SELECT id, ${col} AS token FROM leads WHERE ${col} IS NOT NULL LIMIT 5`);
}

// how many estimates/contracts have NO token at all (context only)
out.estimatesWithoutToken = (await q(
  `SELECT count(*)::int n FROM estimates WHERE public_token IS NULL`))[0].n;

console.log(JSON.stringify(out, null, 1));
await pool.end();
