import 'dotenv/config';
import pool from './src/db/pool.js';
const T='791bb51d-3293-4839-92e9-bd4d4f873af2';
const r=await pool.query("SELECT id,provider,is_active FROM financing_lenders WHERE tenant_id=$1",[T]);
const p=await pool.query("SELECT id,is_active,lender_id FROM financing_plans WHERE tenant_id=$1 LIMIT 3",[T]);
console.log('lenders',JSON.stringify(r.rows));console.log('plans',JSON.stringify(p.rows));
process.exit(0);
