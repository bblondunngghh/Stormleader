import pool from './src/db/pool.js';
const t = (await pool.query(`select name, content from contract_templates`)).rows;
const toks = new Set();
for(const r of t) for(const s of (r.content?.sections||[])) {
  for(const m of String(s.body||'').match(/\{\{\s*[\w.]+\s*\}\}/g)||[]) toks.add(m.trim());
  for(const m of String(s.title||'').match(/\{\{\s*[\w.]+\s*\}\}/g)||[]) toks.add(m.trim());
}
console.log('merge tokens used by templates:', [...toks].sort().join(' '));
// does the PDF renderer substitute them?
await pool.end();
