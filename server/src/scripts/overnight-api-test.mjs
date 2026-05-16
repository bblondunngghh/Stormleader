#!/usr/bin/env node
// Overnight API test runner. Hits every GET endpoint, records status + shape,
// reports 5xx, 4xx, and unexpected shapes. Also runs targeted error-handling
// probes for the heavy-work POST endpoints flagged in the resume.

import http from 'node:http';

const BASE = 'http://localhost:3001';
const EMAIL = 'brandon@accessvaletparking.com';
const PASS = '1234';
const SLUG = 'waterloo';

function req(method, path, { token, body, raw } = {}) {
  return new Promise((resolve) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) {
      headers['Content-Type'] = 'application/json';
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
          resolve({ status: res.statusCode, ct: res.headers['content-type'], len: buf.length, body: raw ? buf : json, raw: buf });
        });
      }
    );
    r.on('timeout', () => { r.destroy(new Error('timeout')); });
    r.on('error', (e) => resolve({ status: 0, err: String(e) }));
    if (data) r.write(data);
    r.end();
  });
}

async function login() {
  const r = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: PASS, tenantSlug: SLUG } });
  if (r.status !== 200) throw new Error('login failed: ' + r.status + ' ' + r.raw);
  return r.body.accessToken;
}

// ---- ROUTE INVENTORY ----------------------------------------------------
// (method, path, optionalNotes)
const ROUTES = [
  // GETs (read-only, safe)
  ['GET', '/api/auth/me'],
  ['GET', '/api/storms'],
  ['GET', '/api/map/properties?bbox=-100,30,-95,35'],
  ['GET', '/api/map/affected-properties?stormEventId=1'],
  ['GET', '/api/map/swaths'],
  ['GET', '/api/dashboard/stats'],
  ['GET', '/api/dashboard/funnel'],
  ['GET', '/api/dashboard/activity'],
  ['GET', '/api/properties'],
  ['GET', '/api/properties/import-progress'],
  ['GET', '/api/leads'],
  ['GET', '/api/skip-trace/config'],
  ['GET', '/api/skip-trace/balance'],
  ['GET', '/api/skip-trace/invoices'],
  ['GET', '/api/skip-trace/usage'],
  ['GET', '/api/skip-trace/jobs'],
  ['GET', '/api/alerts/config'],
  ['GET', '/api/alerts/history'],
  ['GET', '/api/counties'],
  ['GET', '/api/crm/leads'],
  ['GET', '/api/crm/tasks'],
  ['GET', '/api/crm/pipeline/stages'],
  ['GET', '/api/crm/pipeline/metrics'],
  ['GET', '/api/crm/dashboard/stats'],
  ['GET', '/api/crm/dashboard/activity'],
  ['GET', '/api/crm/dashboard/properties-affected'],
  ['GET', '/api/crm/dashboard/properties-affected/list'],
  ['GET', '/api/crm/dashboard/followups'],
  ['GET', '/api/crm/dashboard/conversion-by-storm'],
  ['GET', '/api/crm/dashboard/estimate-summary'],
  ['GET', '/api/crm/dashboard/ar-summary'],
  ['GET', '/api/crm/dashboard/estimating-conversion'],
  ['GET', '/api/crm/dashboard/leaderboard'],
  ['GET', '/api/crm/dashboard/tasks-today'],
  ['GET', '/api/crm/dashboard/days-in-stage'],
  ['GET', '/api/crm/dashboard/stale-leads'],
  ['GET', '/api/crm/dashboard/customer-storm-alerts'],
  ['GET', '/api/crm/dashboard/lead-source-revenue'],
  ['GET', '/api/crm/team'],
  ['GET', '/api/crm/tenant-settings'],
  ['GET', '/api/crm/prospect-lists'],
  ['GET', '/api/crm/calendar'],
  ['GET', '/api/crm/custom-fields'],
  ['GET', '/api/crm/financing/lenders'],
  ['GET', '/api/crm/financing/plans'],
  ['GET', '/api/crm/financing/applications'],
  ['GET', '/api/crm/contracts'],
  ['GET', '/api/crm/contracts/templates'],
  ['GET', '/api/crm/automations'],
  ['GET', '/api/crm/invoices'],
  ['GET', '/api/crm/canvass-pins'],
  ['GET', '/api/crm/canvass-pins/stats'],
  ['GET', '/api/crm/reports/revenue'],
  ['GET', '/api/crm/reports/pipeline'],
  ['GET', '/api/crm/reports/conversion'],
  ['GET', '/api/crm/reports/rep-performance'],
  ['GET', '/api/crm/reports/stage-duration'],
  ['GET', '/api/crm/reports/lead-sources'],
  ['GET', '/api/crm/work-orders'],
  ['GET', '/api/crm/work-orders/milestone-templates'],
  ['GET', '/api/crm/drip-sequences'],
  ['GET', '/api/crm/expenses'],
  ['GET', '/api/crm/subcontractors'],
  ['GET', '/api/crm/territories'],
  ['GET', '/api/estimates'],
  ['GET', '/api/estimates/templates'],
  ['GET', '/api/notifications'],
  ['GET', '/api/notifications/unread-count'],
  ['GET', '/api/notifications/preferences'],
  ['GET', '/api/search?q=test'],
  ['GET', '/api/documents'],
  ['GET', '/api/roof-measurement/config'],
  ['GET', '/api/roof-measurement/usage'],
  ['GET', '/api/roof-measurement/balance'],
  ['GET', '/api/onboarding/plans'],
  ['GET', '/api/admin/overview'],
  ['GET', '/api/admin/tenants'],
  ['GET', '/api/admin/revenue'],
  ['GET', '/api/admin/usage'],
  ['GET', '/api/payments/connect/status'],
  ['GET', '/api/payments/history'],
  ['GET', '/api/materials/products'],
  ['GET', '/api/materials/branches'],
  ['GET', '/api/materials/orders'],
  ['GET', '/api/materials/credentials'],
  ['GET', '/api/disaster-declarations'],
  ['GET', '/api/storm-history?lat=32.78&lng=-96.80'],
  ['GET', '/api/storm-history/heatmap'],
  ['GET', '/api/data/fema-housing?lat=32.78&lng=-96.80'],
  ['GET', '/api/data/directions?from=32.78,-96.80&to=32.79,-96.81'],
];

// Error-handling probes (POST with empty body — expect 400, not 500)
const ERROR_PROBES = [
  ['POST', '/api/auth/login', {}],         // missing body
  ['POST', '/api/auth/register', {}],      // missing body
  ['POST', '/api/crm/leads', {}],          // missing required fields
  ['POST', '/api/crm/leads/quick', {}],
  ['POST', '/api/crm/activities', {}],
  ['POST', '/api/crm/tasks', {}],
  ['POST', '/api/estimates', {}],
  ['POST', '/api/crm/invoices', {}],
  ['POST', '/api/crm/work-orders', {}],
  ['POST', '/api/crm/drip-sequences', {}],
  ['POST', '/api/crm/expenses', {}],
  ['POST', '/api/crm/subcontractors', {}],
  ['POST', '/api/crm/territories', {}],
  ['POST', '/api/crm/automations', {}],
  ['POST', '/api/crm/financing/lenders', {}],
  ['POST', '/api/crm/canvass-pins', {}],
  ['POST', '/api/properties/geocode', {}],
  // The heavy-work guards flagged in carry-over #1
  ['POST', '/api/drift/correct-all', {}],
  ['POST', '/api/properties/trigger-import', {}],
  ['POST', '/api/crm/leads/score-all', {}],
];

(async () => {
  const token = await login();
  console.log('# overnight-api-test', new Date().toISOString());
  console.log('# token len:', token.length);
  console.log();
  console.log('## GET endpoint coverage');
  console.log();

  const results = [];
  for (const [method, path] of ROUTES) {
    const t0 = Date.now();
    const r = await req(method, path, { token });
    const ms = Date.now() - t0;
    const ok = r.status >= 200 && r.status < 300;
    const flag = !ok ? (r.status >= 500 ? '**5XX**' : (r.status === 404 ? '404' : (r.status >= 400 ? '4XX' : 'BAD'))) : 'ok';
    let shape = '';
    if (ok && r.body) {
      if (Array.isArray(r.body)) shape = `array[${r.body.length}]`;
      else if (typeof r.body === 'object') {
        const keys = Object.keys(r.body);
        shape = `obj{${keys.slice(0, 5).join(',')}${keys.length > 5 ? '…' : ''}}`;
      } else shape = typeof r.body;
    }
    const line = `${flag.padEnd(5)} ${String(r.status).padEnd(3)} ${String(ms).padStart(5)}ms ${method} ${path}  ${shape}`;
    console.log(line);
    if (r.status >= 500) {
      console.log('     5XX BODY: ' + (r.raw || '').slice(0, 400));
    }
    results.push({ method, path, status: r.status, ms, shape, raw: r.raw });
  }

  console.log();
  console.log('## Error-handling probes (POST empty body)');
  console.log();
  for (const [method, path, body] of ERROR_PROBES) {
    const t0 = Date.now();
    const r = await req(method, path, { token, body });
    const ms = Date.now() - t0;
    const flag = r.status >= 500 ? '**5XX**' : (r.status === 400 ? '400' : (r.status === 422 ? '422' : (r.status >= 200 && r.status < 300 ? '**2xx-permissive**' : String(r.status))));
    console.log(`${flag.padEnd(20)} ${String(r.status).padEnd(3)} ${String(ms).padStart(5)}ms ${method} ${path}`);
    if (r.status >= 500 || (r.status >= 200 && r.status < 300)) {
      console.log('     BODY: ' + (r.raw || '').slice(0, 400));
    }
  }

  console.log();
  console.log('## Summary');
  const buckets = { ok: 0, '4xx': 0, '5xx': 0, '404': 0 };
  for (const r of results) {
    if (r.status >= 200 && r.status < 300) buckets.ok++;
    else if (r.status === 404) buckets['404']++;
    else if (r.status >= 500) buckets['5xx']++;
    else buckets['4xx']++;
  }
  console.log(JSON.stringify(buckets));
})();
