// Ground truth for lead.source. READ-ONLY.
import pool from './src/db/pool.js';

const { rows: dist } = await pool.query(
  `SELECT source, COUNT(*)::int AS n
     FROM leads
    WHERE deleted_at IS NULL
    GROUP BY source ORDER BY n DESC`
);
console.log('=== ALL TENANTS: distinct leads.source ===');
dist.forEach((r) => console.log(String(r.source).padEnd(18), r.n));

const { rows: t } = await pool.query(
  `SELECT l.source, COUNT(*)::int AS n
     FROM leads l JOIN tenants tn ON tn.id = l.tenant_id
    WHERE l.deleted_at IS NULL AND tn.slug = 'waterloo'
    GROUP BY l.source ORDER BY n DESC`
);
console.log('\n=== tenant waterloo only ===');
t.forEach((r) => console.log(String(r.source).padEnd(18), r.n));

const { rows: col } = await pool.query(
  `SELECT data_type, udt_name FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'source'`
);
console.log('\nsource column type:', JSON.stringify(col[0]));

if (col[0]?.data_type === 'USER-DEFINED') {
  const { rows: en } = await pool.query(
    `SELECT e.enumlabel FROM pg_enum e
       JOIN pg_type ty ON ty.oid = e.enumtypid
      WHERE ty.typname = $1 ORDER BY e.enumsortorder`,
    [col[0].udt_name]
  );
  console.log('ENUM allowed values:', en.map((r) => r.enumlabel).join(', '));
}

const UI = ['storm_auto', 'manual', 'referral', 'website', 'door_knock', 'phone', 'other'];
const real = t.map((r) => r.source);
console.log('\nUI filter options :', UI.join(', '));
console.log('real (waterloo)   :', real.join(', '));
console.log('UI options matching ZERO waterloo rows:', UI.filter((u) => !real.includes(u)).join(', ') || '(none)');
const unreachable = t.filter((r) => !UI.includes(r.source));
console.log('waterloo rows with NO UI option       :',
  unreachable.map((r) => `${r.source}(${r.n})`).join(', ') || '(none)',
  '=>', unreachable.reduce((a, r) => a + r.n, 0), 'of', t.reduce((a, r) => a + r.n, 0), 'leads unfilterable');

await pool.end();
