import pool from './src/db/pool.js';
import fs from 'fs';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const LEADSEL = `SELECT id FROM leads WHERE tenant_id='${T}' AND (
   contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%123 Test St%'
   OR contact_email ILIKE '%qa2026%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%'
   OR address ILIKE '%QA Street%' OR address ILIKE '%QA Blvd%' OR address ILIKE '%QA Probe%'
   OR address ILIKE '%Run34 Test%')`;
const ESTSEL = `SELECT id FROM estimates WHERE tenant_id='${T}' AND (
   lead_id IN (${LEADSEL}) OR customer_name ILIKE 'QA%')`;

// 1. BACKUP
const backup = {};
for (const [k, sql] of [
  ['leads', `SELECT * FROM leads WHERE id IN (${LEADSEL})`],
  ['estimates', `SELECT * FROM estimates WHERE id IN (${ESTSEL})`],
  ['contracts', `SELECT * FROM contracts WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
  ['invoices', `SELECT * FROM invoices WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
  ['work_orders', `SELECT * FROM work_orders WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
  ['activities', `SELECT * FROM activities WHERE lead_id IN (${LEADSEL})`],
  ['contacts', `SELECT * FROM contacts WHERE lead_id IN (${LEADSEL})`],
  ['expenses', `SELECT * FROM expenses WHERE lead_id IN (${LEADSEL})`],
  ['financing_applications', `SELECT * FROM financing_applications WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
]) backup[k] = (await pool.query(sql)).rows;
fs.writeFileSync('C:/tmp/qa-r82-cleanup-backup.json', JSON.stringify(backup, null, 1));
console.log('BACKUP rows:', Object.entries(backup).map(([k,v])=>`${k}=${v.length}`).join(' '));

// 2. DELETE (children first; leads cascade handles the rest)
const c = await pool.connect();
try {
  await c.query('BEGIN');
  const steps = [
    ['payments(on QA inv)', `DELETE FROM payments WHERE estimate_id IN (${ESTSEL})`],
    ['contracts', `DELETE FROM contracts WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
    ['invoices', `DELETE FROM invoices WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
    ['work_orders', `DELETE FROM work_orders WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
    ['financing_applications', `DELETE FROM financing_applications WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`],
    ['estimates', `DELETE FROM estimates WHERE id IN (${ESTSEL})`],
    ['leads (cascades)', `DELETE FROM leads WHERE id IN (${LEADSEL})`],
  ];
  for (const [l, sql] of steps) console.log('  deleted', l, (await c.query(sql)).rowCount);
  await c.query('COMMIT');
  console.log('COMMIT ok');
} catch (e) { await c.query('ROLLBACK'); console.log('ROLLBACK', e.code, e.message); }
finally { c.release(); }

const after = await pool.query(`SELECT 'leads' t,count(*)::int c FROM leads WHERE tenant_id=$1
 UNION ALL SELECT 'estimates',count(*)::int FROM estimates WHERE tenant_id=$1
 UNION ALL SELECT 'invoices',count(*)::int FROM invoices WHERE tenant_id=$1
 UNION ALL SELECT 'contracts',count(*)::int FROM contracts WHERE tenant_id=$1
 UNION ALL SELECT 'work_orders',count(*)::int FROM work_orders WHERE tenant_id=$1
 UNION ALL SELECT 'tasks',count(*)::int FROM tasks WHERE tenant_id=$1`, [T]);
console.log('AFTER:', after.rows.map(r=>`${r.t}=${r.c}`).join(' '));
await pool.end();
