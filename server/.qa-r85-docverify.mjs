// Verify the two documents.js fixes: (1) malformed tags -> 400 not 500,
// (2) a valid tagged upload now stores real jsonb and reads back as an array.
// Every document created here is deleted again.
import fs from 'fs';
const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json', 'utf8'));
const STAMP = 'qa20260822';

const mk = (tags) => {
  const fd = new FormData();
  fd.append('file', new Blob([`${STAMP} qa text file`], { type: 'text/plain' }), `${STAMP}.txt`);
  fd.append('type', 'other');
  fd.append('lead_id', IDS.lead);
  if (tags !== undefined) fd.append('tags', tags);
  return fd;
};
const post = async (fd) => {
  const r = await fetch(BASE + '/documents/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN }, body: fd });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, json: j, text: t };
};
const del = async (id) => {
  const r = await fetch(`${BASE}/documents/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } });
  return r.status;
};

const results = [];
const T = (label, cond, detail) => { results.push({ label, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : ' — ' + detail}`); };

// 1. malformed tags
const bad = await post(mk('not-json'));
T('malformed tags -> 400 (was 500)', bad.status === 400, `got ${bad.status} ${bad.text.slice(0, 120)}`);
T('malformed tags message names the field', /tags/i.test(bad.text), bad.text.slice(0, 120));
if (bad.json?.id) await del(bad.json.id);

// 2. valid array tags
const good = await post(mk('["qa","roof"]'));
T('valid array tags -> 201 (was 400)', good.status === 201, `got ${good.status} ${good.text.slice(0, 160)}`);
if (good.json?.id) {
  T('tags read back as a real array', Array.isArray(good.json.tags) && good.json.tags.join(',') === 'qa,roof', JSON.stringify(good.json.tags));
  // 3. jsonb round-trip through the LIST endpoint too
  const list = await fetch(BASE + '/documents?limit=50', { headers: { Authorization: 'Bearer ' + TOKEN } });
  const lj = await list.json().catch(() => null);
  const arr = Array.isArray(lj) ? lj : (lj?.documents || lj?.data || []);
  const mine = arr.find(d => d.id === good.json.id);
  T('GET /documents returns the tagged row', !!mine, `list had ${arr.length} rows`);
  if (mine) T('list tags are an array too', Array.isArray(mine.tags), JSON.stringify(mine.tags));
  T('cleanup: document deleted', await del(good.json.id) === 200);
}

// 4. no-tags upload still works (regression guard on the refactor)
const plain = await post(mk(undefined));
T('upload with no tags still 201', plain.status === 201, `got ${plain.status} ${plain.text.slice(0, 120)}`);
if (plain.json?.id) {
  T('no-tags row stores NULL tags', plain.json.tags === null, JSON.stringify(plain.json.tags));
  T('cleanup: plain document deleted', await del(plain.json.id) === 200);
}

// 5. object (non-array) tags — jsonb accepts it; must not 500
const obj = await post(mk('{"k":"v"}'));
T('object tags does not 5xx', obj.status < 500, `got ${obj.status}`);
if (obj.json?.id) await del(obj.json.id);

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
