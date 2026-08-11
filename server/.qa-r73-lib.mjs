// Run 73 s1 — shared request helper.
// JWT lifetime is only 15 MINUTES, so this auto-refreshes the token on any 401.
// Never read the token from a file: /tmp differs between Git Bash (=%TEMP%) and node (=C:\tmp),
// which silently fed a stale Run-72 token into the first sweep of this run.
import fs from 'fs';

export const BASE = 'http://localhost:3001';
const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

let token = null;

export async function mint() {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  const d = await res.json();
  if (!d.accessToken) throw new Error('LOGIN FAILED: ' + JSON.stringify(d).slice(0, 200));
  token = d.accessToken;
  try { fs.writeFileSync('C:/tmp/qa-token.txt', token); } catch { /* best effort */ }
  return token;
}

export function currentToken() { return token; }

// Performs the request, transparently re-minting once if the token has expired.
export async function req(method, path, body, opts = {}) {
  if (!token) await mint();
  const send = async () => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (opts.noAuth) delete headers.Authorization;
    const init = { method, headers };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + path, init);
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 400); }
      return { status: res.status, ms: Date.now() - t0, body: parsed };
    } catch (e) {
      return { status: 0, ms: Date.now() - t0, body: 'FETCH_ERROR: ' + e.message };
    }
  };
  let out = await send();
  if (out.status === 401 && !opts.noAuth) {
    await mint();
    out = await send();
    out.refreshed = true;
  }
  return out;
}

export function summarize(body) {
  if (body && typeof body === 'object') {
    return Array.isArray(body)
      ? `array[${body.length}]`
      : Object.keys(body).slice(0, 8).join(',');
  }
  return String(body).slice(0, 120);
}
