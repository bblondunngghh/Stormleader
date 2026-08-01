import pg from 'pg'; import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Projects/stormleads/.env' });
const cs = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: cs, ssl: cs.includes('neon.tech') ? { rejectUnauthorized: false } : undefined });
for (const t of ['contract_templates','contracts']) {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
  console.log(`${t}: ${rows.map(r=>r.column_name).join(', ')}`);
}
await pool.end();
