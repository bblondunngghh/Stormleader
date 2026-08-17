// Run 77 s1 — shared request helper.
// LOGIN IS RATE LIMITED (~10 tries -> 15 min lockout). This lib NEVER mints on its own;
// it reads the token that was minted once at the start of the stage into C:/tmp/qa-token.txt.
import fs from 'fs';

export const BASE = 'http://localhost:3001';
const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

let token = null;
let mintCount = 0;

try { token = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim(); } catch { /* none yet */ }

export async function mint() {
  mintCount += 1;
  if (mintCount > 2) throw new Error('REFUSING to mint a 3rd time in one process — login is rate limited');
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

export async function req(method, path, body, opts = {}) {
  if (!token) await mint();
  const send = async () => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    if (opts.noAuth) delete headers.Authorization;
    if (opts.headers) Object.assign(headers, opts.headers);
    const init = { method, headers };
    if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + path, init);
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 400); }
      return { status: res.status, ms: Date.now() - t0, body: parsed, raw: text };
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
    return Array.isArray(body) ? `array[${body.length}]` : Object.keys(body).slice(0, 10).join(',');
  }
  return String(body).slice(0, 140);
}
