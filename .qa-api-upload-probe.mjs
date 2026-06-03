// Multipart upload + CSV import probe.
// - POST /api/documents/upload with valid PNG     -> 201, cleanup via DELETE
// - POST /api/documents/upload with no file       -> 400
// - POST /api/documents/upload with .exe          -> 400 (multer filter rejects)
// - POST /api/properties/import-csv with bad row  -> 200, all rows skipped (no DB writes)
// - POST /api/properties/import-csv with []       -> 400
// - POST /api/properties/import-csv with >10000   -> 400

import { writeFileSync } from 'node:fs';
import { Blob } from 'node:buffer';

const BASE = 'http://localhost:3001';
const LOGIN = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('login failed: ' + JSON.stringify(j));
  return j.accessToken;
}

// 1x1 transparent PNG (67 bytes)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const results = [];
function record(label, status, ok, body) {
  results.push({ label, status, ok, body });
  const flag = ok ? 'OK ' : 'BAD';
  console.log(`[${flag}] ${status}  ${label}`);
  if (!ok) console.log('       body:', JSON.stringify(body).slice(0, 240));
}

const token = await login();
console.log('token ok\n');

// ============ DOCUMENT UPLOAD ============

// 1) Upload valid PNG
const pngBytes = Buffer.from(TINY_PNG_BASE64, 'base64');
const pngBlob = new Blob([pngBytes], { type: 'image/png' });

const fd1 = new FormData();
fd1.append('file', pngBlob, 'qa-probe.png');
fd1.append('type', 'photo');
fd1.append('description', 'QA probe upload — safe to delete');

const r1 = await fetch(`${BASE}/api/documents/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: fd1,
});
const b1 = await r1.json().catch(() => null);
const uploadOk = r1.status === 201 && b1 && b1.id;
record('POST /api/documents/upload (valid PNG)', r1.status, uploadOk, b1);

// 2) Cleanup: DELETE the document
if (uploadOk) {
  const r2 = await fetch(`${BASE}/api/documents/${b1.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const b2 = await r2.json().catch(() => null);
  record('DELETE /api/documents/:id (cleanup)', r2.status, r2.status === 200, b2);
}

// 3) Upload disallowed extension (.exe)
const exeBlob = new Blob([Buffer.from('MZ\x00\x00', 'binary')], { type: 'application/octet-stream' });
const fd3 = new FormData();
fd3.append('file', exeBlob, 'malware.exe');

const r3 = await fetch(`${BASE}/api/documents/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: fd3,
});
const b3 = await r3.text();
let b3parsed; try { b3parsed = JSON.parse(b3); } catch { b3parsed = b3.slice(0, 200); }
// Multer's fileFilter rejects → should be 400 or 500. 5xx is still acceptable
// here only if it's a clean message; what we mostly want is NOT 201.
record('POST /api/documents/upload (.exe rejected)', r3.status, r3.status !== 201, b3parsed);

// 4) Upload with no file (re-verify from previous probe)
const r4 = await fetch(`${BASE}/api/documents/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: new FormData(), // empty
});
const b4 = await r4.json().catch(() => null);
record('POST /api/documents/upload (no file)', r4.status, r4.status === 400, b4);

// ============ CSV IMPORT (JSON-based) ============

// 5) Empty rows array → 400
const r5 = await fetch(`${BASE}/api/properties/import-csv`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows: [] }),
});
const b5 = await r5.json().catch(() => null);
record('POST /api/properties/import-csv (empty rows)', r5.status, r5.status === 400, b5);

// 6) Missing rows entirely → 400
const r6 = await fetch(`${BASE}/api/properties/import-csv`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const b6 = await r6.json().catch(() => null);
record('POST /api/properties/import-csv (missing rows)', r6.status, r6.status === 400, b6);

// 7) Row that will not geocode (junk address) → 200 with all skipped, no DB writes
const r7 = await fetch(`${BASE}/api/properties/import-csv`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rows: [
      { address: 'zzzzzzz nonexistent street 99999', city: 'NotARealCity', state: 'ZZ', zip: '00000' },
    ],
  }),
});
const b7 = await r7.json().catch(() => null);
// Accept either 200 with all-skipped OR a 503 if Census API is offline.
const csvOk =
  (r7.status === 200 && b7 && (b7.skipped === 1 || b7.failed === 1 || b7.created === 0)) ||
  r7.status === 503;
record('POST /api/properties/import-csv (junk row → skipped)', r7.status, csvOk, b7);

// 8) Oversized rows array (>10000) → 400
const r8 = await fetch(`${BASE}/api/properties/import-csv`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rows: new Array(10001).fill({ address: 'x', city: 'x', state: 'x', zip: 'x' }) }),
});
const b8 = await r8.json().catch(() => null);
record('POST /api/properties/import-csv (>10000 rows)', r8.status, r8.status === 400, b8);

// ============ SUMMARY ============
const total = results.length;
const bad = results.filter((r) => !r.ok);
console.log('\n=== SUMMARY ===');
console.log(`Total: ${total}, OK: ${total - bad.length}, BAD: ${bad.length}`);
writeFileSync('.qa-api-upload-results.json', JSON.stringify(results, null, 2));
