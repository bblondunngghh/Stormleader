import pool from './src/db/pool.js';
const r = await pool.query(`SELECT name, type, content FROM contract_templates ORDER BY name`);
for (const t of r.rows) {
  const secs = Array.isArray(t.content) ? t.content : (t.content?.sections || []);
  console.log('###', t.name, '| type=' + t.type, '| sections=' + secs.length);
  for (const s of secs) console.log('   -', s.title, '::', String(s.body || '').replace(/\s+/g,' ').slice(0, 150));
}
await pool.end();
