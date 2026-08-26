// Run 96 / s4 — DEFINITIVE re-verification of tonight's 4 UI key-mismatch fixes.
//
// Each fix was "the JSX read a key the API never sends". The ground truth is
// therefore the REAL API response key set, not the table columns (several of the
// keys involved are query aliases that exist only on the payload).
//
// For each fix: assert every key the NEW code reads is present on the payload,
// and every key the OLD code read is absent. READ ONLY (GETs only).
import fs from 'node:fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const BASE = 'http://localhost:3001';

async function get(p) {
  const r = await fetch(BASE + p, { headers: { authorization: 'Bearer ' + TOKEN } });
  let b = null; try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
}
const rowsOf = b => Array.isArray(b) ? b : (b?.leads || b?.estimates || b?.data || b?.items || []);

function report(title, keys, present, sampleVals) {
  console.log(`\n${title}`);
  for (const k of keys) {
    const has = present.has(k);
    const v = sampleVals[k];
    console.log(`  ${has ? 'PRESENT' : 'ABSENT '}  ${k.padEnd(22)} ${has ? `sample=${JSON.stringify(v)}` : ''}`);
  }
}

let fails = 0;
const expect = (label, cond) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) fails++;
};

// ---------------------------------------------------------------- 716471a
// WorkOrders EstimatePickerModal. Fetches the estimates LIST.
const estList = await get('/api/crm/estimates?limit=20');
const eRows = rowsOf(estList.body);
const eKeys = new Set(eRows.length ? Object.keys(eRows[0]) : []);
const eSample = eRows[0] || {};
console.log(`=== 716471a  work-order estimate picker — /api/crm/estimates -> ${estList.status}, ${eRows.length} rows, ${eKeys.size} keys`);
report('keys the OLD code read (must be ABSENT):', ['title', 'contact_name'], eKeys, eSample);
report('keys the NEW code reads (must be PRESENT):', ['estimate_name', 'customer_name', 'lead_name', 'lead_address', 'estimate_number'], eKeys, eSample);
expect('old keys `title`/`contact_name` are not on the payload', !eKeys.has('title') && !eKeys.has('contact_name'));
expect('new keys `estimate_name` + `customer_name` ARE on the payload', eKeys.has('estimate_name') && eKeys.has('customer_name'));
// How many rows actually gain a real name from the fix?
const named = eRows.filter(r => r.estimate_name).length;
const subtitled = eRows.filter(r => r.customer_name || r.lead_name || r.lead_address).length;
console.log(`  OBSERVABLE: ${named}/${eRows.length} rows render a real estimate_name; ${subtitled}/${eRows.length} render a real subtitle`);

// ---------------------------------------------------------------- be61054 / f9b0c8f
// ContractsView lead search dropdown + selectLead. Fetches the leads LIST.
const leadList = await get('/api/crm/leads?limit=20');
const lRows = rowsOf(leadList.body);
const lKeys = new Set(lRows.length ? Object.keys(lRows[0]) : []);
const lSample = lRows[0] || {};
console.log(`\n=== be61054 / f9b0c8f  contract lead search — /api/crm/leads -> ${leadList.status}, ${lRows.length} rows, ${lKeys.size} keys`);
report('keys the OLD code read (must be ABSENT):', ['owner_name', 'first_name', 'email', 'phone'], lKeys, lSample);
report('keys the NEW code reads (must be PRESENT):', ['contact_name', 'contact_email', 'contact_phone', 'owner_first_name', 'owner_last_name', 'owner_email', 'owner_phone', 'address'], lKeys, lSample);
expect('old keys owner_name/first_name/email/phone are not on the payload',
  !lKeys.has('owner_name') && !lKeys.has('first_name') && !lKeys.has('email') && !lKeys.has('phone'));
expect('new keys contact_name/contact_email/contact_phone ARE on the payload',
  lKeys.has('contact_name') && lKeys.has('contact_email') && lKeys.has('contact_phone'));

const nameOld = r => r.owner_name || r.first_name || '';
const nameNew = r => r.contact_name || [r.owner_first_name, r.owner_last_name].filter(Boolean).join(' ');
const dashOld = lRows.filter(r => !nameOld(r)).length;
const dashNew = lRows.filter(r => !nameNew(r)).length;
console.log(`  OBSERVABLE (be61054 dropdown): rows rendering a bare dash — OLD ${dashOld}/${lRows.length}, NEW ${dashNew}/${lRows.length}`);
expect('the fix removes the bare dash for at least one row', dashNew < dashOld);

const emailOld = lRows.filter(r => r.email).length;
const emailNew = lRows.filter(r => r.contact_email || r.owner_email).length;
console.log(`  OBSERVABLE (f9b0c8f selectLead): rows that populate CUSTOMER EMAIL — OLD ${emailOld}/${lRows.length}, NEW ${emailNew}/${lRows.length}`);
console.log(`  -> Send Contract (disabled unless customerEmail) becomes usable for ${emailNew - emailOld} more leads`);
expect('the fix populates customerEmail for at least one lead', emailNew > emailOld);

// ---------------------------------------------------------------- a04aa8e
// ContractBuilder fromEstimate prefill. Fetches an estimate DETAIL.
const withLead = eRows.filter(r => r.lead_id);
console.log(`\n=== a04aa8e  contract-from-estimate prefill — ${withLead.length}/${eRows.length} estimates are lead-linked`);
if (withLead.length) {
  const det = await get(`/api/crm/estimates/${withLead[0].id}`);
  const d = det.body?.estimate || det.body || {};
  const dKeys = new Set(Object.keys(d));
  console.log(`  detail /api/crm/estimates/${withLead[0].id} -> ${det.status}, ${dKeys.size} keys`);
  report('keys the NEW code falls back to (must be PRESENT on the DETAIL payload):',
    ['lead_email', 'lead_phone', 'lead_name', 'lead_address', 'customer_email', 'customer_phone'], dKeys, d);
  expect('lead_email + lead_phone ARE joined into the estimate detail payload',
    dKeys.has('lead_email') && dKeys.has('lead_phone'));
  const oldEmail = d.customer_email || '';
  const newEmail = d.customer_email || d.lead_email || '';
  console.log(`  OBSERVABLE on this row: CUSTOMER EMAIL  OLD=${JSON.stringify(oldEmail)}  NEW=${JSON.stringify(newEmail)}`);
  console.log(`  Send Contract would be  OLD=${oldEmail ? 'enabled' : 'DISABLED'}  NEW=${newEmail ? 'enabled' : 'DISABLED'}`);
} else {
  console.log('  NO lead-linked estimate exists — the prefill path is unreachable on this dataset.');
}

console.log(`\n${fails === 0 ? 'ALL KEY ASSERTIONS PASS' : `${fails} ASSERTION(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
