// Run 124-s4 — READ-ONLY. Pulls one real share token for each of the three PUBLIC,
// customer-facing routes (/estimate/:token, /contract/:token, /status/:token) so the
// verify stage can load surfaces that live OUTSIDE the authenticated app shell and
// have therefore never appeared in any 19-route sweep.
import pool from './src/db/pool.js';
const q = async (sql) => { try { const r = await pool.query(sql); return r.rows; } catch (e) { return [{ ERR: e.code + ' ' + e.message.slice(0,90) }]; } };
const T = (await q(`SELECT id FROM tenants WHERE slug='waterloo'`))[0].id;
console.log('estimate:', JSON.stringify(await q(`SELECT public_token, status FROM estimates WHERE tenant_id='${T}' AND public_token IS NOT NULL LIMIT 3`)));
console.log('contract:', JSON.stringify(await q(`SELECT token, status FROM contracts WHERE tenant_id='${T}' AND token IS NOT NULL LIMIT 3`)));
console.log('status:  ', JSON.stringify(await q(`SELECT token FROM client_status_tokens LIMIT 3`)));
console.log('counts:  ', JSON.stringify(await q(`SELECT (SELECT count(*) FROM estimates WHERE public_token IS NOT NULL) est_tok, (SELECT count(*) FROM contracts WHERE token IS NOT NULL) con_tok, (SELECT count(*) FROM client_status_tokens) sts`)));
await pool.end();
