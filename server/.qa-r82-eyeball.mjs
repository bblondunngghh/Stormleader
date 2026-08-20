import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const r = await pool.query(`SELECT contact_name, address, source, created_at::date d FROM leads WHERE tenant_id=$1 AND (
   contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%123 Test St%'
   OR contact_email ILIKE '%qa2026%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%'
   OR address ILIKE '%QA Street%' OR address ILIKE '%QA Blvd%' OR address ILIKE '%QA Probe%'
   OR address ILIKE '%Run34 Test%') ORDER BY d DESC`, [T]);
for (const x of r.rows) console.log(`${String(x.contact_name).padEnd(32)} | ${String(x.address).padEnd(38)} | ${String(x.source).padEnd(12)} | ${String(x.d).slice(0,10)}`);
console.log('---- SURVIVORS ----');
const s = await pool.query(`SELECT contact_name, address FROM leads WHERE tenant_id=$1 AND NOT (
   contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%123 Test St%'
   OR contact_email ILIKE '%qa2026%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%'
   OR address ILIKE '%QA Street%' OR address ILIKE '%QA Blvd%' OR address ILIKE '%QA Probe%'
   OR address ILIKE '%Run34 Test%') IS NOT FALSE AND id NOT IN (SELECT id FROM leads WHERE tenant_id=$1 AND (
   contact_name ILIKE '%qa%' OR contact_name ILIKE '%test%' OR address ILIKE '%123 Test St%'
   OR contact_email ILIKE '%qa2026%' OR address ILIKE '%QA7%' OR address ILIKE '%QA8%'
   OR address ILIKE '%QA Street%' OR address ILIKE '%QA Blvd%' OR address ILIKE '%QA Probe%'
   OR address ILIKE '%Run34 Test%')) LIMIT 40`, [T]);
for (const x of s.rows) console.log(`${String(x.contact_name).padEnd(32)} | ${x.address}`);
await pool.end();
