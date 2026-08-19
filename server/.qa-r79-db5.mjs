import 'dotenv/config';
import pool from './src/db/pool.js';
const c=(await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='estimates' AND column_name ILIKE '%token%'")).rows;
const d=(await pool.query("SELECT id,token,status FROM contracts WHERE tenant_id='791bb51d-3293-4839-92e9-bd4d4f873af2' AND token IS NOT NULL LIMIT 3")).rows;
console.log('estimate token cols',JSON.stringify(c));
console.log('contract tokens',JSON.stringify(d.map(x=>({id:x.id,status:x.status,tok:(x.token||'').slice(0,10)}))));
process.exit(0);
