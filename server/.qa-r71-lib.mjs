// Run 71 shared harness lib.
// CRITICAL: access tokens have a 900s (15 min) TTL. Any sweep longer than that
// starts returning 401 for every route and looks exactly like a broken auth layer.
// This lib re-mints automatically on 401 and retries once.
import fs from 'fs';

export const BASE = 'http://localhost:3001';
const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

let token = null;
let mintedAt = 0;

export async function mint() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  if (!r.ok) throw new Error('login failed ' + r.status);
  const j = await r.json();
  token = j.accessToken;
  mintedAt = Date.now();
  try { fs.writeFileSync('C:/tmp/qa-token.txt', token); } catch {}
  return token;
}

async function tok() {
  // re-mint proactively at 10 min, well inside the 15 min TTL
  if (!token || Date.now() - mintedAt > 10 * 60 * 1000) await mint();
  return token;
}

export async function api(method, path, body, opts = {}) {
  const send = async () => {
    const headers = { Authorization: `Bearer ${await tok()}` };
    let payload;
    if (body !== undefined) {
      if (opts.raw) { headers['Content-Type'] = 'application/json'; payload = body; }
      else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    }
    return fetch(BASE + path, { method, headers, body: payload });
  };
  let res;
  try { res = await send(); }
  catch (e) { return { status: 0, body: String(e.message) }; }
  if (res.status === 401) { await mint(); try { res = await send(); } catch (e) { return { status: 0, body: String(e.message) }; } }
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

export const GET = (p) => api('GET', p);
export const POST = (p, b) => api('POST', p, b);
export const PATCH = (p, b) => api('PATCH', p, b);
export const PUT = (p, b) => api('PUT', p, b);
export const DEL = (p, b) => api('DELETE', p, b);

export function snip(b, n = 220) {
  return (typeof b === 'string' ? b : JSON.stringify(b) || '').slice(0, n);
}

// Pull the first array out of any list-shaped response.
export function rows(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const v = Object.values(body).find(Array.isArray);
    if (v) return v;
  }
  return [];
}
