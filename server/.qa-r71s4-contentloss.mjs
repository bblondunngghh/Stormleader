import pool from './src/db/pool.js';
const rows = (await pool.query(`select id, content from contracts order by created_at`)).rows;
// Replay the exact guard from routes/contracts.js:187-201
function replay(raw){
  let rawContent = raw;
  if (typeof rawContent === 'string') { try { rawContent = JSON.parse(rawContent); } catch {} }
  const bodyFromPlainText = typeof rawContent === 'string' ? rawContent : '';
  if (!rawContent || typeof rawContent !== 'object') rawContent = {};
  const parsed = (Array.isArray(rawContent.sections) ? rawContent.sections : []).filter(s => s && typeof s === 'object');
  return parsed.length ? parsed : [{ title:'Agreement', body: bodyFromPlainText }];
}
let loss = 0;
for (const r of rows){
  const stored = r.content;
  const secs = replay(stored);
  const renderedChars = secs.reduce((n,s)=> n + String(s.title||'').length + String(s.body||'').length, 0);
  const storedChars = JSON.stringify(stored||'').length;
  const storedSectionCount = Array.isArray(stored?.sections) ? stored.sections.length : (typeof stored==='string'?'(plain string)':'(no sections array)');
  const empty = renderedChars === 0;
  if (empty) loss++;
  console.log(`${(r.id.slice(0,8)).padEnd(16)} storedType=${(typeof stored).padEnd(7)} storedSections=${String(storedSectionCount).padEnd(22)} -> rendered ${secs.length} section(s), ${renderedChars} chars (stored json ${storedChars}) ${empty?'*** RENDERS EMPTY':'ok'}`);
  if (secs.length) console.log(`     first section title="${String(secs[0].title||'').slice(0,50)}" body="${String(secs[0].body||'').slice(0,60).replace(/\n/g,' ')}"`);
}
console.log('\ncontracts that would render an EMPTY pdf:', loss, 'of', rows.length);
await pool.end();
