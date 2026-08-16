import pool from './src/db/pool.js';
const q = async (s, p) => (await pool.query(s, p)).rows;
console.log('--- users columns ---');
console.log((await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name='users' order by ordinal_position`))
  .map(r => `${r.column_name.padEnd(24)} ${r.data_type.padEnd(28)} null=${r.is_nullable} def=${r.column_default ?? ''}`).join('\n'));
console.log('\n--- does users.is_active exist? ---');
console.log(await q(`select count(*)::int as n from information_schema.columns where table_name='users' and column_name='is_active'`));
console.log('\n--- any table with an is_active column ---');
console.log(await q(`select table_name from information_schema.columns where column_name='is_active' and table_schema='public'`));
console.log('\n--- run the exact predicate ---');
try {
  console.log(await q(`SELECT u.id FROM users u WHERE u.is_active = true LIMIT 1`));
} catch (e) {
  console.log('THROWS:', e.code, e.message);
}
await pool.end();
