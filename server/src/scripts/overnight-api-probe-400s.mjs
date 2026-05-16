#!/usr/bin/env node
// Probe the 8 endpoints that returned 400 to confirm they're legitimate
// missing-param 400s and not a coding bug.

import http from 'node:http';

const BASE = 'http://localhost:3001';

function req(method, path, { token, body } = {}) {
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
        res.on('end', () => resolve({ status: res.statusCode, raw: buf }));
      }
    );
    r.on('error', (e) => resolve({ status: 0, err: String(e) }));
    if (data) r.write(data);
    r.end();
  });
}

const login = await req('POST', '/api/auth/login', { body: { email: 'brandon@accessvaletparking.com', password: '1234', tenantSlug: 'waterloo' } });
const token = JSON.parse(login.raw).accessToken;

const paths = [
  '/api/map/affected-properties?stormEventId=1',
  '/api/map/swaths',
  '/api/properties',
  '/api/crm/calendar',
  '/api/disaster-declarations',
  '/api/storm-history/heatmap',
  '/api/data/fema-housing?lat=32.78&lng=-96.80',
  '/api/data/directions?from=32.78,-96.80&to=32.79,-96.81',
];

for (const p of paths) {
  const r = await req('GET', p, { token });
  console.log(`${r.status} ${p}`);
  console.log('  ' + r.raw.slice(0, 300));
}
