import pool from './src/db/pool.js';
const { rows } = await pool.query(`SELECT column_name, data_type, udt_name, column_default, is_nullable
  FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('status','completed_at') ORDER BY column_name`);
console.log(JSON.stringify(rows, null, 1));
const { rows: e } = await pool.query(`SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname LIKE '%task%' GROUP BY t.typname`);
console.log('enums:', JSON.stringify(e));
const { rows: c } = await pool.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
  WHERE conrelid='tasks'::regclass AND contype='c'`);
console.log('checks:', JSON.stringify(c));
await pool.end();
