// Edge-case probe: malformed JSON, non-UUID :id params, no auth, expired auth.

import { writeFileSync } from 'node:fs';

const API = 'http://localhost:3001';

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'waterlooconstruction1@gmail.com',
      password: '2Wealth&health',
      tenantSlug: 'waterloo',
    }),
  });
  return (await r.json()).accessToken;
}

const token = await login();

const cases = [];

// 1. Malformed JSON body to a POST
cases.push(['malformed-json', async () => {
  const r = await fetch(`${API}/api/crm/leads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{this is not json',
  });
  return { status: r.status, body: await r.text() };
}]);

// 2. Non-UUID :id param to a validateId() route
cases.push(['bad-uuid-leads', async () => {
  const r = await fetch(`${API}/api/crm/leads/not-a-uuid`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.text() };
}]);

cases.push(['bad-uuid-estimates', async () => {
  const r = await fetch(`${API}/api/estimates/not-a-uuid`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.text() };
}]);

// 3. Numeric :id where UUID expected
cases.push(['numeric-id-property', async () => {
  const r = await fetch(`${API}/api/properties/12345`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.text() };
}]);

// 4. No auth on protected route
cases.push(['no-auth-leads', async () => {
  const r = await fetch(`${API}/api/crm/leads`);
  return { status: r.status, body: await r.text() };
}]);

// 5. Invalid auth token
cases.push(['bad-token-leads', async () => {
  const r = await fetch(`${API}/api/crm/leads`, {
    headers: { Authorization: 'Bearer totally-fake-token' },
  });
  return { status: r.status, body: await r.text() };
}]);

// 6. Unknown path under /api
cases.push(['unknown-route', async () => {
  const r = await fetch(`${API}/api/nonsense-route`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.text() };
}]);

// 7. SQL-injection-ish search query
cases.push(['sql-inj-search', async () => {
  const r = await fetch(`${API}/api/search/?q=' OR 1=1--`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: await r.text() };
}]);

// 8. Huge limit
cases.push(['huge-limit', async () => {
  const r = await fetch(`${API}/api/crm/leads?limit=999999999`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}]);

// 9. Negative offset (already-clamped by recent fix)
cases.push(['neg-offset', async () => {
  const r = await fetch(`${API}/api/crm/leads?offset=-99`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
}]);

// 10. POST to GET-only route
cases.push(['wrong-method', async () => {
  const r = await fetch(`${API}/api/crm/dashboard/stats`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return { status: r.status, body: await r.text() };
}]);

const results = {};
for (const [name, fn] of cases) {
  try {
    results[name] = await fn();
  } catch (e) {
    results[name] = { status: 'ERR', body: String(e) };
  }
  const r = results[name];
  const flag = (r.status === 'ERR' || (typeof r.status === 'number' && r.status >= 500)) ? '!!' : '  ';
  console.log(`${flag} ${String(r.status).padEnd(4)}  ${name.padEnd(22)}  ${String(r.body).slice(0, 100)}`);
}

writeFileSync('C:/Projects/stormleads/.qa-api-edge-results.json', JSON.stringify(results, null, 2));

const bad = Object.entries(results).filter(([, v]) => v.status === 'ERR' || (typeof v.status === 'number' && v.status >= 500));
console.log('');
console.log(`5xx / err count: ${bad.length}`);
