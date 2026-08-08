import pool from './src/db/pool.js';
import fs from 'fs';
const snap = JSON.parse(fs.readFileSync('C:/tmp/qa-r71-snapshot.json','utf8'));
// Restore the pre-probe JSONB state. notes was NOT captured in the snapshot and the
// guard-regression probe wrote 'guard regression probe' into it -> reset to NULL.
const { rows } = await pool.query(
  `UPDATE estimates SET upgrades=$2::jsonb, financing_plan_ids=$3::jsonb,
     insurance_details=$4::jsonb, notes=NULL
   WHERE id=$1 RETURNING estimate_number, upgrades, financing_plan_ids, insurance_details, notes, line_items`,
  [snap.id, JSON.stringify([null]), JSON.stringify(snap.financing_plan_ids), JSON.stringify(snap.insurance_details)]);
console.log('restored:', JSON.stringify(rows[0]));
await pool.end();
