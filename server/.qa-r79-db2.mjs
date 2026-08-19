import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql, p=[]) => { try { const r = await pool.query(sql,p); return r.rows; } catch(e){ return [{ERR:e.message}]; } };
const out = {};
out.propCols = (await q("SELECT column_name FROM information_schema.columns WHERE table_name='properties' ORDER BY ordinal_position")).map(r=>r.column_name);
out.propSample = await q("SELECT id FROM properties LIMIT 2");
out.counts = await q(`SELECT 'properties' t, count(*) FROM properties
 UNION ALL SELECT 'leads', count(*) FROM leads
 UNION ALL SELECT 'estimates', count(*) FROM estimates
 UNION ALL SELECT 'documents', count(*) FROM documents
 UNION ALL SELECT 'notifications', count(*) FROM notifications
 UNION ALL SELECT 'drip_sequences', count(*) FROM drip_sequences
 UNION ALL SELECT 'automations', count(*) FROM automations
 UNION ALL SELECT 'canvass_territories', count(*) FROM canvass_territories`);
out.tenants = await q("SELECT id, slug FROM tenants LIMIT 5");
console.log(JSON.stringify(out, null, 1));
process.exit(0);
