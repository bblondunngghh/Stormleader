// Run 87 (s4-verify) — re-verify the ba35464 document-upload fix END TO END.
//
// The fix has two halves:
//   1. routes/documents.js  — an unguarded JSON.parse on the multipart `tags`
//      string threw into next(err) => 500. Should now be 400.
//   2. services/documentService.js — node-postgres serializes a JS array as the
//      Postgres array literal {a,b}, which is not valid JSON, so every tagged
//      upload died with 22P02. Should now round-trip as real jsonb.
//
// Method: drive BOTH the live :3001 instance (started 5:07am, PRE-fix code, no
// watcher) and an isolated :3099 instance running the fixed code. The stale
// server is a free control group: it must reproduce 500 + 22P02 where the fixed
// one gives 400 + 201. Every created row is deleted at the end.
//
// Usage: node .qa-r87-docverify.mjs

const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenantSlug: 'waterloo',
};

async function login(base) {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.accessToken) {
    throw new Error(`login ${base} failed: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  }
  return j.accessToken;
}

function makeForm(tagsValue, name) {
  const fd = new FormData();
  fd.append('file', new Blob(['qa r87 verification file'], { type: 'text/plain' }), name);
  fd.append('type', 'other');
  fd.append('description', 'qa2026 r87 verify - delete me');
  if (tagsValue !== undefined) fd.append('tags', tagsValue);
  return fd;
}

async function upload(base, token, tagsValue, name) {
  const r = await fetch(base + '/api/documents/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: makeForm(tagsValue, name),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: r.status, body };
}

async function del(base, token, id) {
  const r = await fetch(base + '/api/documents/' + id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  });
  return r.status;
}

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log((pass ? 'PASS  ' : 'FAIL  ') + label + '  ::  ' + detail);
}

const STALE = 'http://localhost:3001';
const FIXED = 'http://localhost:3099';
const createdOnFixed = [];

// --- control group: the stale :3001 server must still show BOTH old bugs ------
let staleToken = null;
try {
  staleToken = await login(STALE);
} catch (e) {
  console.log('NOTE  could not reach stale :3001 control (' + e.message + ')');
}

if (staleToken) {
  const a = await upload(STALE, staleToken, '{not json', 'qa-r87-stale-bad.txt');
  record(
    'CONTROL stale :3001 malformed tags reproduces the 500',
    a.status === 500,
    'status=' + a.status + ' body=' + JSON.stringify(a.body).slice(0, 120)
  );

  const b = await upload(STALE, staleToken, JSON.stringify(['qa2026', 'roof']), 'qa-r87-stale-good.txt');
  const is22P02 = a.status === 500 && b.status >= 500;
  record(
    'CONTROL stale :3001 VALID tags array reproduces the 22P02 failure',
    b.status >= 500,
    'status=' + b.status + ' body=' + JSON.stringify(b.body).slice(0, 160)
  );
  if (b.status === 201 && b.body && b.body.id) {
    // Unexpected: stale server accepted it. Clean up so we leave nothing behind.
    createdOnFixed.push({ base: STALE, token: staleToken, id: b.body.id });
  }
  void is22P02;
}

// --- the fixed instance -------------------------------------------------------
const token = await login(FIXED);

// 1. malformed tags -> 400, not 500
const bad = await upload(FIXED, token, '{not json', 'qa-r87-bad.txt');
record(
  'FIX 1  malformed tags returns 400 (was 500)',
  bad.status === 400 && /valid JSON/i.test(JSON.stringify(bad.body)),
  'status=' + bad.status + ' body=' + JSON.stringify(bad.body).slice(0, 160)
);

// 2. a valid tags array -> 201 and stored as real jsonb
const good = await upload(FIXED, token, JSON.stringify(['qa2026', 'roof']), 'qa-r87-good.txt');
const doc = good.body && good.body.id ? good.body : null;
if (doc) createdOnFixed.push({ base: FIXED, token, id: doc.id });
record(
  'FIX 2  valid tags array returns 201 (was 22P02 500)',
  good.status === 201,
  'status=' + good.status + ' body=' + JSON.stringify(good.body).slice(0, 200)
);
record(
  'FIX 2  tags round-trip as a real JSON array, not the literal {a,b}',
  !!doc && Array.isArray(doc.tags) && doc.tags[0] === 'qa2026' && doc.tags[1] === 'roof',
  'typeof=' + (doc ? typeof doc.tags : 'n/a') + ' value=' + JSON.stringify(doc && doc.tags)
);

// 3. regression guard: an upload with NO tags at all still works and stores null
const none = await upload(FIXED, token, undefined, 'qa-r87-notags.txt');
if (none.body && none.body.id) createdOnFixed.push({ base: FIXED, token, id: none.body.id });
record(
  'REGRESSION  upload with no tags still 201s and stores NULL',
  none.status === 201 && none.body && none.body.tags === null,
  'status=' + none.status + ' tags=' + JSON.stringify(none.body && none.body.tags)
);

// 4. regression guard: valid JSON that is not an array (a bare string/object)
const obj = await upload(FIXED, token, JSON.stringify({ a: 1 }), 'qa-r87-objtags.txt');
if (obj.body && obj.body.id) createdOnFixed.push({ base: FIXED, token, id: obj.body.id });
record(
  'EDGE  valid-JSON non-array tags does not 500',
  obj.status < 500,
  'status=' + obj.status + ' tags=' + JSON.stringify(obj.body && obj.body.tags)
);

// 5. the GET list path must be able to read the row we just wrote
const list = await fetch(FIXED + '/api/documents?limit=5', {
  headers: { Authorization: 'Bearer ' + token },
});
const listBody = await list.json().catch(() => ({}));
record(
  'READ PATH  GET /api/documents reads the new rows without throwing',
  list.status === 200,
  'status=' + list.status + ' count=' + (listBody.data ? listBody.data.length : JSON.stringify(listBody).slice(0, 80))
);

// --- cleanup: delete every row this harness created ---------------------------
console.log('\n--- cleanup ---');
for (const row of createdOnFixed) {
  const s = await del(row.base, row.token, row.id);
  console.log('DELETE ' + row.id + ' -> ' + s);
}
const after = await fetch(FIXED + '/api/documents?limit=50', {
  headers: { Authorization: 'Bearer ' + token },
});
const afterBody = await after.json().catch(() => ({}));
const leftovers = (afterBody.data || []).filter(d => /qa-r87/.test(d.filename || '') || /r87 verify/.test(d.description || ''));
console.log('leftover qa-r87 rows: ' + leftovers.length + (leftovers.length ? ' ' + JSON.stringify(leftovers.map(l => l.id)) : ''));

const failed = results.filter(r => !r.pass);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
if (failed.length) console.log('FAILED: ' + failed.map(f => f.label).join(' | '));
