// QA endpoint regression sweep — runs against http://localhost:3001/api
// Tests safe GET endpoints with auth. Records status + brief diagnostic.

import fs from 'node:fs';

const BASE = 'http://localhost:3001/api';
const EMAIL = 'brandon@accessvaletparking.com';
const PASS = '1234';
const TENANT = 'waterloo';

// Sample IDs from resume notes
const SAMPLE_LEAD = '3fa29df8-589c-44a6-ac4d-88cb78243cbe';
const SAMPLE_TOKEN = '9efaf018e533c98c86553aa92b37f3abb18871baa45985c50f0bd9383d2cdbdc';
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

async function login() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, tenantSlug: TENANT }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + JSON.stringify(j));
  return j.accessToken;
}

async function hit(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let r;
  try {
    r = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { status: 'FETCH_ERR', err: e.message, path };
  }
  const ct = r.headers.get('content-type') || '';
  let bodyText = '';
  let preview = '';
  try {
    bodyText = await r.text();
    if (ct.includes('application/json')) {
      try {
        const j = JSON.parse(bodyText);
        preview = j.error || j.message || (Array.isArray(j) ? `array[${j.length}]` : `keys:${Object.keys(j).slice(0, 5).join(',')}`);
      } catch {
        preview = bodyText.slice(0, 80);
      }
    } else {
      preview = `${ct} ${bodyText.length}b`;
    }
  } catch {}
  return { status: r.status, path, method, bytes: bodyText.length, preview: preview.slice(0, 120) };
}

const endpoints = [
  // auth
  ['GET', '/auth/me'],

  // dashboard (top-level)
  ['GET', '/dashboard/stats'],
  ['GET', '/dashboard/funnel'],
  ['GET', '/dashboard/activity'],

  // crm dashboards
  ['GET', '/crm/dashboard/stats'],
  ['GET', '/crm/dashboard/activity'],
  ['GET', '/crm/dashboard/properties-affected'],
  ['GET', '/crm/dashboard/properties-affected/list'],
  ['GET', '/crm/dashboard/followups'],
  ['GET', '/crm/dashboard/conversion-by-storm'],
  ['GET', '/crm/dashboard/estimate-summary'],
  ['GET', '/crm/dashboard/ar-summary'],
  ['GET', '/crm/dashboard/estimating-conversion'],
  ['GET', '/crm/dashboard/leaderboard'],
  ['GET', '/crm/dashboard/tasks-today'],
  ['GET', '/crm/dashboard/days-in-stage'],
  ['GET', '/crm/dashboard/stale-leads'],
  ['GET', '/crm/dashboard/customer-storm-alerts'],
  ['GET', '/crm/dashboard/lead-source-revenue'],

  // crm leads
  ['GET', '/crm/leads'],
  ['GET', '/crm/leads?stage=new'],
  ['GET', '/crm/leads?recent=true'],
  ['GET', `/crm/leads/${SAMPLE_LEAD}`],
  ['GET', `/crm/leads/${SAMPLE_LEAD}/activities`],
  ['GET', `/crm/leads/${FAKE_UUID}`, 'expect:404'],

  // crm tasks, pipeline, team
  ['GET', '/crm/tasks'],
  ['GET', '/crm/pipeline/stages'],
  ['GET', '/crm/pipeline/metrics'],
  ['GET', '/crm/team'],
  ['GET', '/crm/tenant-settings'],
  ['GET', '/crm/calendar'],
  ['GET', '/crm/custom-fields'],

  // crm prospect lists
  ['GET', '/crm/prospect-lists'],

  // crm sub-routers
  ['GET', '/crm/automations'],
  ['GET', '/crm/invoices'],
  ['GET', '/crm/canvass-pins'],
  ['GET', '/crm/canvass-pins/stats'],
  ['GET', '/crm/reports/revenue'],
  ['GET', '/crm/reports/pipeline'],
  ['GET', '/crm/reports/conversion'],
  ['GET', '/crm/reports/rep-performance'],
  ['GET', '/crm/reports/stage-duration'],
  ['GET', '/crm/reports/lead-sources'],
  ['GET', '/crm/work-orders'],
  ['GET', '/crm/work-orders/milestone-templates'],
  ['GET', '/crm/drip-sequences'],
  ['GET', '/crm/expenses'],
  ['GET', `/crm/expenses/summary/${SAMPLE_LEAD}`],
  ['GET', '/crm/subcontractors'],
  ['GET', '/crm/territories'],
  ['GET', '/crm/contracts'],
  ['GET', '/crm/contracts/templates'],

  // financing (new this branch)
  ['GET', '/crm/financing/lenders'],
  ['GET', '/crm/financing/plans'],
  ['GET', '/crm/financing/applications'],
  ['GET', `/crm/financing/applications/${FAKE_UUID}`, 'expect:404'],

  // estimates
  ['GET', '/estimates'],
  ['GET', '/estimates/templates'],

  // storms
  ['GET', '/storms'],

  // notifications
  ['GET', '/notifications'],
  ['GET', '/notifications/unread-count'],
  ['GET', '/notifications/preferences'],

  // search
  ['GET', '/search?q=test'],

  // documents
  ['GET', '/documents'],

  // properties (safe ones only — NEVER touch FEMA)
  ['GET', '/properties'],

  // counties
  ['GET', '/counties'],

  // alerts
  ['GET', '/alerts/config'],
  ['GET', '/alerts/history'],

  // map (heavy but read-only)
  ['GET', '/map/properties'],
  ['GET', '/map/swaths'],

  // disaster declarations, storm history
  ['GET', '/disaster-declarations'],
  ['GET', '/storm-history'],
  ['GET', '/storm-history/heatmap'],

  // materials
  ['GET', '/materials/products'],
  ['GET', '/materials/branches'],
  ['GET', '/materials/orders'],
  ['GET', '/materials/credentials'],

  // skip trace
  ['GET', '/skip-trace/config'],
  ['GET', '/skip-trace/balance'],
  ['GET', '/skip-trace/invoices'],
  ['GET', '/skip-trace/usage'],
  ['GET', '/skip-trace/jobs'],

  // roof measurement
  ['GET', '/roof-measurement/config'],
  ['GET', '/roof-measurement/usage'],
  ['GET', '/roof-measurement/balance'],

  // onboarding
  ['GET', '/onboarding/plans'],

  // admin
  ['GET', '/admin/overview'],
  ['GET', '/admin/tenants'],
  ['GET', '/admin/revenue'],
  ['GET', '/admin/usage'],

  // payments
  ['GET', '/payments/connect/status'],
  ['GET', '/payments/history'],

  // public endpoints (no auth)
  ['GET', `/estimates/public/${SAMPLE_TOKEN}`, 'noauth'],
  ['GET', `/crm/contracts/public/${SAMPLE_TOKEN}`, 'noauth'],
  ['GET', `/crm/financing/public/${SAMPLE_TOKEN}/plans`, 'noauth'],
  ['GET', `/crm/financing/public/${SAMPLE_TOKEN}/applications`, 'noauth'],
];

(async () => {
  const token = await login();
  console.log('Token OK, sweeping', endpoints.length, 'endpoints...');

  const results = [];
  for (const [method, path, flag] of endpoints) {
    const useToken = flag === 'noauth' ? null : token;
    const r = await hit(method, path, useToken);
    const note = flag === 'expect:404' ? (r.status === 404 ? '✓expected404' : `EXPECTED 404 got ${r.status}`)
               : flag === 'noauth' ? 'public'
               : '';
    results.push({ ...r, note });
    const tag = r.status === 500 || r.status === 'FETCH_ERR' ? '🔴'
              : r.status >= 400 && r.status < 500 ? '🟡'
              : r.status >= 200 && r.status < 300 ? '✅'
              : '⚪';
    console.log(`${tag} ${String(r.status).padEnd(5)} ${method.padEnd(6)} ${path} ${note}`);
    if (r.preview && (r.status >= 400 || flag === 'expect:404')) {
      console.log(`        ↳ ${r.preview}`);
    }
  }

  // Summary
  const fail500 = results.filter(r => r.status === 500 || r.status === 'FETCH_ERR');
  const ok = results.filter(r => r.status >= 200 && r.status < 300);
  const auth = results.filter(r => r.status === 401);
  const notFound = results.filter(r => r.status === 404);
  const badReq = results.filter(r => r.status === 400);

  console.log('\n=== SUMMARY ===');
  console.log('Total:', results.length);
  console.log('2xx OK:', ok.length);
  console.log('400 Bad Request:', badReq.length);
  console.log('401 Unauthorized:', auth.length);
  console.log('404 Not Found:', notFound.length);
  console.log('500/FETCH_ERR:', fail500.length);
  if (fail500.length) {
    console.log('\n=== 5xx/ERR DETAILS ===');
    fail500.forEach(r => console.log(`  ${r.method} ${r.path} → ${r.status} :: ${r.preview || r.err}`));
  }

  // Write report
  const lines = [
    '| Endpoint | Method | Status | Bytes | Note | Preview |',
    '|---|---|---|---|---|---|',
    ...results.map(r => `| ${r.path} | ${r.method} | ${r.status} | ${r.bytes ?? '-'} | ${r.note} | ${(r.preview || '').replace(/\|/g, '\\|')} |`),
    '',
    `Total: ${results.length} | 2xx: ${ok.length} | 400: ${badReq.length} | 401: ${auth.length} | 404: ${notFound.length} | 5xx/ERR: ${fail500.length}`,
  ];
  fs.writeFileSync('.qa-api-results.txt', lines.join('\n'));
  console.log('\nWrote .qa-api-results.txt');
})();
