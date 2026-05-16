#!/usr/bin/env node
// Fourth-pass: edge-case probes
// - Auth refresh flow
// - Missing-auth on protected endpoints (should be 401, not 500)
// - Malformed JSON body
// - Public-token endpoints (should be 404 for bogus token, not 500)

import http from 'node:http';
const BASE = 'http://localhost:3001';

function req(method, path, { token, body, rawBody, headers: extraHeaders } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    let data = null;
    if (body) data = JSON.stringify(body);
    else if (rawBody !== undefined) data = rawBody;
    const headers = { 'Accept': 'application/json', ...(extraHeaders || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data != null) {
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 15000 },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = buf ? JSON.parse(buf) : null; } catch {}
          resolve({ status: res.statusCode, body: json, raw: buf });
        });
      }
    );
    r.on('error', (e) => resolve({ status: 0, err: String(e) }));
    if (data != null) r.write(data);
    r.end();
  });
}

const login = await req('POST', '/api/auth/login', { body: { email: 'brandon@accessvaletparking.com', password: '1234', tenantSlug: 'waterloo' } });
console.log('# login status:', login.status, 'body keys:', login.body && Object.keys(login.body));
const token = login.body.accessToken;
const refreshToken = login.body.refreshToken;
console.log('# token defined:', !!token, 'refreshToken defined:', !!refreshToken);

const issues = [];
function check(label, status, expected, raw) {
  const ok = (typeof expected === 'number') ? status === expected : expected.includes(status);
  const tag = ok ? 'ok' : '**FAIL**';
  console.log(`${tag.padEnd(8)} ${String(status).padEnd(3)} ${label}`);
  if (!ok) {
    console.log('     ' + (raw || '').slice(0, 400));
    issues.push({ label, status, raw });
  }
}

console.log('## Auth refresh flow');
const r1 = await req('POST', '/api/auth/refresh', { body: { refreshToken } });
check('POST /api/auth/refresh (valid)', r1.status, [200], r1.raw);
const r1b = await req('POST', '/api/auth/refresh', { body: { refreshToken: 'totally-bogus-token' } });
check('POST /api/auth/refresh (bogus)', r1b.status, [400, 401, 403], r1b.raw);

console.log();
console.log('## Missing auth (should be 401, not 500)');
const protectedRoutes = [
  ['GET', '/api/crm/leads'],
  ['GET', '/api/crm/tasks'],
  ['GET', '/api/estimates'],
  ['GET', '/api/dashboard/stats'],
  ['GET', '/api/notifications'],
  ['GET', '/api/admin/overview'],
  ['GET', '/api/crm/work-orders'],
];
for (const [m, p] of protectedRoutes) {
  const r = await req(m, p);  // no token
  check(`${m} ${p} (no token)`, r.status, [401], r.raw);
}

console.log();
console.log('## Malformed JSON body (should be 400, not 500)');
const r2 = await req('POST', '/api/crm/leads/quick', { token, rawBody: '{not valid json' });
check('POST /api/crm/leads/quick (bad json)', r2.status, [400], r2.raw);

console.log();
console.log('## Public-token endpoints with bogus token (should be 404, not 500)');
const publicRoutes = [
  ['GET', '/api/estimates/public/bogus-token-123'],
  ['GET', '/api/crm/contracts/public/bogus-token-123'],
  ['GET', '/api/leads/status/public/bogus-token-123'],
  ['GET', '/api/crm/financing/public/bogus-token-123/plans'],
  ['GET', '/api/crm/financing/public/bogus-token-123/applications'],
];
for (const [m, p] of publicRoutes) {
  const r = await req(m, p);  // no auth — these are public
  check(`${m} ${p} (bogus token)`, r.status, [404, 400, 403], r.raw);
}

console.log();
console.log('## Pagination probes (large page sizes)');
const paginated = [
  ['GET', '/api/crm/leads?limit=1000'],
  ['GET', '/api/estimates?limit=1000'],
  ['GET', '/api/crm/invoices?limit=1000'],
  ['GET', '/api/crm/work-orders?limit=1000'],
  ['GET', '/api/crm/tasks?limit=1000'],
];
for (const [m, p] of paginated) {
  const r = await req(m, p, { token });
  check(`${m} ${p}`, r.status, [200], r.raw);
}

console.log();
console.log('## Filter combinations');
const filtered = [
  ['GET', '/api/crm/leads?stage=new&limit=5'],
  ['GET', '/api/crm/leads?priority=hot&limit=5'],
  ['GET', '/api/crm/leads?search=test&limit=5'],
  ['GET', '/api/crm/tasks?completed=false&limit=5'],
  ['GET', '/api/estimates?status=draft&limit=5'],
  ['GET', '/api/crm/calendar?start=2026-05-01&end=2026-05-31'],
  ['GET', '/api/notifications?limit=5'],
  ['GET', '/api/search?q=brandon'],
];
for (const [m, p] of filtered) {
  const r = await req(m, p, { token });
  check(`${m} ${p}`, r.status, [200], r.raw);
}

console.log();
console.log(`## Summary — issues: ${issues.length}`);
if (issues.length > 0) console.log(JSON.stringify(issues, null, 2));
