import 'dotenv/config';
import pool from './src/db/pool.js';
const r = await pool.query("SELECT sender_email, (branding->>'smtp_host') AS smtp_host, (branding->>'smtp_user') AS smtp_user FROM tenants WHERE id='791bb51d-3293-4839-92e9-bd4d4f873af2'");
console.log(JSON.stringify(r.rows));
process.exit(0);
