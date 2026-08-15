// Run 75 s1 — pass 2: resolve param ids FROM THE LIVE LIST ENDPOINT, not a hand map.
// Pass 1 left 8 param routes on a dead uuid (404 before handler = blind spot).
// Here: for each param route, GET its parent collection, pull a real id out of the
// response, then re-request. Also resolves REAL public tokens from the DB.
import fs from 'fs';
import pool from './src/db/pool.js';
import { req, summarize } from './.qa-r73-lib.mjs';

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const inv = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// pull the first plausible id out of any list-shaped response
function firstId(body) {
  if (!body || typeof body !== 'object') return null;
  const arrays = Array.isArray(body) ? [body] : Object.values(body).filter(Array.isArray);
  for (const arr of arrays) {
    for (const el of arr) {
      if (el && typeof el === 'object' && el.id !== undefined && el.id !== null) return String(el.id);
    }
  }
  return null;
}

// the 8 blind spots from pass 1 + their parent collections
const targets = [
  ['/api/counties/:id/status', '/api/counties'],
  ['/api/crm/drip-sequences/:id', '/api/crm/drip-sequences'],
  ['/api/crm/financing/applications/:id', '/api/crm/financing/applications'],
  ['/api/crm/prospect-lists/:id/items', '/api/crm/prospect-lists'],
  ['/api/crm/territories/:id', '/api/crm/territories'],
  ['/api/crm/territories/:id/pins', '/api/crm/territories'],
  ['/api/materials/orders/:id', '/api/materials/orders'],
  ['/api/materials/products/:id', '/api/materials/products'],
  ['/api/storms/:id', '/api/storms'],
];

console.log('=== PASS 2: list-derived real ids ===');
const resolved = {};
for (const [route, listPath] of targets) {
  const list = await req('GET', listPath);
  const id = firstId(list.body);
  console.log(`${listPath} -> ${list.status} ${id ? 'id=' + String(id).slice(0, 40) : 'NO ID (' + summarize(list.body).slice(0, 70) + ')'}`);
  if (!id) { resolved[route] = { status: 'UNRESOLVABLE', listStatus: list.status }; continue; }
  const actual = route.replace(/:[A-Za-z_]+/, id);
  const out = await req('GET', actual);
  resolved[route] = { status: out.status, actual, shape: summarize(out.body) };
  const flag = out.status >= 500 ? ' *** 5xx ***' : '';
  console.log(`  ${route} -> ${out.status}${flag}  ${summarize(out.body).slice(0, 90)}`);
  if (out.status >= 500) console.log('   BODY:', JSON.stringify(out.body).slice(0, 500));
}

// ---- real public tokens (these handlers never ran in any prior sweep) ----
console.log('\n=== PUBLIC TOKEN ROUTES with REAL tokens ===');
const tok = async (sql, args = [T]) => {
  try { const { rows } = await pool.query(sql, args); return rows[0] ? Object.values(rows[0])[0] : null; }
  catch (e) { return 'ERR:' + e.message.slice(0, 60); }
};
const tokens = {
  estimate: await tok(`SELECT public_token FROM estimates WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 1`),
  contract: await tok(`SELECT public_token FROM contracts WHERE tenant_id=$1 AND public_token IS NOT NULL LIMIT 1`),
  status: await tok(`SELECT token FROM client_status_tokens LIMIT 1`, []),
};
console.log('tokens:', JSON.stringify(tokens));

const tokenRoutes = [
  ['/api/estimates/public/:token', tokens.estimate],
  ['/api/crm/contracts/public/:token', tokens.contract],
  ['/api/leads/status/public/:token', tokens.status],
  ['/api/crm/financing/public/:token/plans', tokens.estimate],
  ['/api/crm/financing/public/:token/applications', tokens.estimate],
];
for (const [route, t] of tokenRoutes) {
  if (!t || String(t).startsWith('ERR:')) { console.log(`${route} -> SKIP (no token: ${t})`); continue; }
  const actual = route.replace(':token', t);
  const out = await req('GET', actual);
  const flag = out.status >= 500 ? ' *** 5xx ***' : '';
  console.log(`${route} -> ${out.status}${flag}  ${summarize(out.body).slice(0, 100)}`);
  if (out.status >= 500) console.log('   BODY:', JSON.stringify(out.body).slice(0, 500));
}
await pool.end();
