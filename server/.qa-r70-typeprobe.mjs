// R70 s1 — type-confusion probe on PUT /api/alerts/config.
// updateAlertConfig() whitelists FIELD NAMES but validates no VALUE TYPES, and
// the columns are strongly typed (text[], numeric, int4). Charter question:
// "does it handle bad params gracefully (400, not 500)?"
// Restores the original row at the end.
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TENANT = '791bb51d-3293-4839-92e9-bd4d4f873af2';

const r0 = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const TOKEN = (await r0.json()).accessToken;

async function put(body) {
  const r = await fetch(BASE + '/api/alerts/config', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, text: (await r.text()).slice(0, 220) };
}

const shapes = [
  ['email_recipients string',  { email_recipients: 'notanarray' }],
  ['email_recipients number',  { email_recipients: 12345 }],
  ['email_recipients bool',    { email_recipients: true }],
  ['email_recipients object',  { email_recipients: { a: 1 } }],
  ['email_recipients [null]',  { email_recipients: [null] }],
  ['email_recipients [obj]',   { email_recipients: [{ x: 1 }] }],
  ['min_hail_size_in string',  { min_hail_size_in: 'abc' }],
  ['min_hail_size_in object',  { min_hail_size_in: { a: 1 } }],
  ['digest_hour string',       { digest_hour: 'abc' }],
  ['digest_hour object',       { digest_hour: { a: 1 } }],
  ['enabled string',           { enabled: 'notabool' }],
  ['alert_mode object',        { alert_mode: { a: 1 } }],
  ['alert_mode array',         { alert_mode: [1, 2] }],
];

const out = [];
for (const [name, body] of shapes) {
  const res = await put(body);
  const verdict = res.status >= 500 ? 'BUG-500' : (res.status >= 200 && res.status < 300) ? 'ACCEPTED' : 'rejected';
  out.push({ name, body, ...res, verdict });
  console.log(`${verdict.padEnd(8)} ${String(res.status).padEnd(4)} ${name}  :: ${res.text.slice(0, 130)}`);
}

fs.writeFileSync('C:/tmp/qa-r70-typeprobe.json', JSON.stringify(out, null, 1));
console.log('\n5xx: ' + out.filter(o => o.status >= 500).length +
            '   ACCEPTED: ' + out.filter(o => o.verdict === 'ACCEPTED').length +
            '   rejected: ' + out.filter(o => o.verdict === 'rejected').length);

// ---- restore original row ----
const pool = (await import('./src/db/pool.js')).default;
await pool.query(`
  UPDATE alert_configs SET enabled=true, email_enabled=true, sms_enabled=false,
    email_recipients='{}', sms_recipients='{}', min_hail_size_in=1.00,
    min_wind_speed_mph=58.0, alert_mode='immediate', digest_hour=7
  WHERE tenant_id=$1`, [TENANT]);
const { rows } = await pool.query('SELECT * FROM alert_configs WHERE tenant_id=$1', [TENANT]);
console.log('\nRESTORED ->', JSON.stringify({
  enabled: rows[0].enabled, email_recipients: rows[0].email_recipients,
  min_hail_size_in: rows[0].min_hail_size_in, alert_mode: rows[0].alert_mode,
  digest_hour: rows[0].digest_hour,
}));
await pool.end();
