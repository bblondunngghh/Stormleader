// Stress test heavy-work endpoints (carry-over #6) — fire 5 parallel POSTs
// to each and observe what happens. Looking for:
//   - duplicate side effects
//   - DB lock errors / 5xx
//   - excessive response times

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
  if (!r.ok) throw new Error(`login failed: ${r.status}`);
  return (await r.json()).accessToken;
}

const token = await login();
console.log('token ok\n');

const targets = [
  ['POST', '/api/drift/correct-all', null],
  ['POST', '/api/properties/trigger-import', null],
  ['POST', '/api/crm/leads/score-all', null],
];

for (const [method, path, body] of targets) {
  console.log(`=== ${method} ${path} — 5 parallel ===`);
  const t0 = Date.now();
  const promises = Array.from({ length: 5 }, (_, i) =>
    fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ?? '{}',
    }).then(async (r) => ({
      idx: i,
      status: r.status,
      ms: Date.now() - t0,
      body: (await r.text()).slice(0, 150),
    }))
  );
  const results = await Promise.all(promises);
  for (const r of results) {
    console.log(`   #${r.idx}  ${r.status}  ${r.ms}ms  ${r.body}`);
  }
  const statuses = results.map(r => r.status);
  const fivexx = statuses.filter(s => s >= 500).length;
  if (fivexx > 0) console.log(`   !! ${fivexx} 5xx responses`);
  else console.log(`   ok — no 5xx`);
  console.log();
}
