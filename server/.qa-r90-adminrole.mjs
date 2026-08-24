// Run 90 (s4-verify) — is /admin's 403 a dev-environment artifact or a broken page?
//
// The browser session runs with VITE_DEV_BYPASS_AUTH=true, so the SPA renders the
// DEV_USER (role super_admin, AuthContext.jsx:10-13) while every API call carries the
// real `brandon` token whose role is `admin`. That mismatch is what produces
// "Failed to load overview data." on /admin.
//
// This probe mints a token for the REAL super_admin user with the env JWT_SECRET
// (stable across restarts) and calls each admin endpoint. Read-only: GETs only.
import jwt from 'jsonwebtoken';
import pool from './src/db/pool.js';
import config from './src/config/env.js';

const BASE = process.argv[2] || 'http://localhost:3001';

const { rows } = await pool.query(
  "SELECT id, email, role, tenant_id FROM users WHERE role = 'super_admin' LIMIT 1"
);
if (!rows.length) {
  console.log('NO super_admin USER IN DB — cannot test');
  await pool.end();
  process.exit(1);
}
const u = rows[0];
console.log('super_admin user:', u.email, u.id);

const mk = (role) =>
  jwt.sign({ id: u.id, tenantId: u.tenant_id, email: u.email, role }, config.JWT_SECRET, {
    expiresIn: '15m',
  });

const call = async (path, token) => {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  let b = null;
  try { b = await r.json(); } catch { /* none */ }
  return { status: r.status, keys: b && typeof b === 'object' ? Object.keys(b).slice(0, 8) : b };
};

const PATHS = ['/api/admin/overview', '/api/admin/tenants', '/api/admin/revenue', '/api/admin/usage'];

for (const [label, role] of [['super_admin', 'super_admin'], ['admin (what the browser sends)', 'admin']]) {
  const tok = mk(role);
  console.log(`\n--- as ${label} ---`);
  for (const p of PATHS) {
    const res = await call(p, tok);
    console.log(`  ${res.status}  ${p.padEnd(24)} ${JSON.stringify(res.keys)}`);
  }
}

await pool.end();
