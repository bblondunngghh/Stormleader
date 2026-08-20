import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const LEADSEL = `SELECT id FROM leads WHERE tenant_id='${T}' AND (
   contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%123 Test St%'
   OR contact_email ILIKE '%qa2026%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%'
   OR address ILIKE '%QA Street%' OR address ILIKE '%QA Blvd%' OR address ILIKE '%QA Probe%'
   OR address ILIKE '%Run34 Test%')`;
const ESTSEL = `SELECT id FROM estimates WHERE tenant_id='${T}' AND (
   lead_id IN (${LEADSEL}) OR customer_name ILIKE 'QA%' OR customer_name ILIKE '%QA79%')`;

async function c(l, sql){ const r=await pool.query(sql); console.log(l.padEnd(34), JSON.stringify(r.rows)); }
await c('QA leads', `SELECT count(*)::int n FROM (${LEADSEL}) x`);
await c('QA estimates', `SELECT count(*)::int n FROM (${ESTSEL}) x`);
await c('tasks on QA leads', `SELECT count(*)::int n FROM tasks WHERE lead_id IN (${LEADSEL})`);
await c('activities on QA leads', `SELECT count(*)::int n FROM activities WHERE lead_id IN (${LEADSEL})`);
await c('contracts on QA leads', `SELECT count(*)::int n FROM contracts WHERE lead_id IN (${LEADSEL})`);
await c('contracts on QA estimates', `SELECT count(*)::int n FROM contracts WHERE estimate_id IN (${ESTSEL})`);
await c('invoices on QA leads/ests', `SELECT count(*)::int n FROM invoices WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`);
await c('work_orders on QA', `SELECT count(*)::int n FROM work_orders WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`);
await c('financing_apps on QA', `SELECT count(*)::int n FROM financing_applications WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`);
await c('drip_enrollments on QA', `SELECT count(*)::int n FROM drip_enrollments WHERE lead_id IN (${LEADSEL})`);
await c('documents on QA', `SELECT count(*)::int n FROM documents WHERE lead_id IN (${LEADSEL}) OR estimate_id IN (${ESTSEL})`);
await c('payments on QA ests', `SELECT count(*)::int n FROM payments WHERE estimate_id IN (${ESTSEL})`);
await c('contacts on QA leads', `SELECT count(*)::int n FROM contacts WHERE lead_id IN (${LEADSEL})`);
await c('expenses on QA leads', `SELECT count(*)::int n FROM expenses WHERE lead_id IN (${LEADSEL})`);
await c('SURVIVING leads', `SELECT count(*)::int n FROM leads WHERE tenant_id='${T}' AND id NOT IN (${LEADSEL})`);
await c('SURVIVING estimates', `SELECT count(*)::int n FROM estimates WHERE tenant_id='${T}' AND id NOT IN (${ESTSEL})`);
await c('surviving est numbers', `SELECT estimate_number FROM estimates WHERE tenant_id='${T}' AND id NOT IN (${ESTSEL}) ORDER BY estimate_number`);
await pool.end();
