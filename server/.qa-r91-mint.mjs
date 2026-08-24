import fs from 'fs';
const r = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
});
const j = await r.json();
if (!j.accessToken) { console.log('LOGIN FAIL', r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
fs.writeFileSync('C:/tmp/qa-token.txt', j.accessToken);
const p = JSON.parse(Buffer.from(j.accessToken.split('.')[1], 'base64').toString());
console.log('token minted; role =', p.role, '; exp in', Math.round(p.exp - Date.now() / 1000), 's');
