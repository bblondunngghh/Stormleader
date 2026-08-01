// s4-verify DB hygiene: remove QA-harness junk rows that are USER-VISIBLE in the live UI.
// Scoped strictly to the exact junk names observed; real/built-in templates are untouched.
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const cs = process.env.DATABASE_URL;
const poolConfig = { connectionString: cs };
if (cs.includes('neon.tech') || cs.includes('supabase.com')) poolConfig.ssl = { rejectUnauthorized: false };
const pool = new pg.Pool(poolConfig);

const JUNK = ['{"1","2","3"}', '12345', 'QA Contract Template', 'Test Template'];

const before = await pool.query('SELECT name, COUNT(*)::int AS n FROM contract_templates GROUP BY name ORDER BY n DESC');
console.log('--- BEFORE ---');
before.rows.forEach(r => console.log(`  ${r.n.toString().padStart(3)}  ${JSON.stringify(r.name)}`));

const del = await pool.query('DELETE FROM contract_templates WHERE name = ANY($1::text[]) RETURNING id', [JUNK]);
console.log(`\nDELETED ${del.rowCount} junk contract_templates rows`);

const after = await pool.query('SELECT name, COUNT(*)::int AS n FROM contract_templates GROUP BY name ORDER BY n DESC');
console.log('--- AFTER ---');
after.rows.forEach(r => console.log(`  ${r.n.toString().padStart(3)}  ${JSON.stringify(r.name)}`));

await pool.end();
