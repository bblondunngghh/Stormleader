// Run 96 / s4 — find the rows that make each of tonight's 4 UI fixes OBSERVABLE.
// Without a lead-linked estimate whose lead has an email, a04aa8e cannot be
// distinguished from the broken version. READ ONLY.
import pool from './src/db/pool.js';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2'; // waterloo

// a04aa8e — contract-from-estimate prefill needs lead_email / lead_phone.
const { rows: est } = await pool.query(
  `SELECT e.id, e.estimate_number, e.estimate_name, e.lead_id,
          l.contact_name, l.contact_email, l.contact_phone, l.address
     FROM estimates e JOIN leads l ON l.id = e.lead_id
    WHERE e.tenant_id = $1 AND l.contact_email IS NOT NULL AND l.contact_email <> ''
    ORDER BY e.created_at DESC LIMIT 5`, [T]);
console.log('a04aa8e — lead-linked estimates WITH a lead email:', est.length);
for (const r of est) console.log('  ', r.estimate_number, '|', r.estimate_name, '| lead:', r.contact_name, r.contact_email, r.contact_phone);

// 716471a — the work-order estimate picker lists these.
const { rows: pick } = await pool.query(
  `SELECT e.id, e.estimate_number, e.estimate_name, e.customer_name, l.contact_name AS lead_name, l.address AS lead_address
     FROM estimates e LEFT JOIN leads l ON l.id = e.lead_id
    WHERE e.tenant_id = $1 ORDER BY e.created_at DESC LIMIT 8`, [T]);
console.log('\n716471a — estimate picker rows (name shown should be estimate_name, subtitle customer_name||lead_name):');
for (const r of pick) console.log('  ', r.estimate_number, '| estimate_name=', JSON.stringify(r.estimate_name), '| customer_name=', JSON.stringify(r.customer_name), '| lead_name=', JSON.stringify(r.lead_name));

// be61054 / f9b0c8f — the contract lead-search dropdown + selectLead.
const { rows: leads } = await pool.query(
  `SELECT id, contact_name, contact_email, contact_phone, address,
          owner_first_name, owner_last_name, owner_email, owner_phone
     FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 8`, [T]);
console.log('\nbe61054/f9b0c8f — lead rows (dropdown should show contact_name, never a bare dash):');
for (const r of leads) console.log('  ', JSON.stringify({ n: r.contact_name, e: r.contact_email, p: r.contact_phone, ofn: r.owner_first_name, oln: r.owner_last_name, a: (r.address || '').slice(0, 30) }));

// How many leads would render as a bare dash under the OLD code vs the NEW code?
const nOld = leads.filter(r => !r.owner_name && !r.first_name).length;
const nNew = leads.filter(r => !(r.contact_name || [r.owner_first_name, r.owner_last_name].filter(Boolean).join(' '))).length;
console.log(`\n  dash-rendering rows: OLD code ${nOld}/${leads.length}, NEW code ${nNew}/${leads.length}`);

await pool.end();
