import pool from './src/db/pool.js';
import fs from 'fs';
const num = process.argv[2] || 'EST-001';
const out = process.argv[3];
const r = await pool.query(`SELECT * FROM estimates WHERE estimate_number = $1`, [num]);
const row = r.rows[0];
if (out) fs.writeFileSync(out, JSON.stringify(row, null, 1));
console.log(JSON.stringify({ estimate_number: row.estimate_number, id: row.id, financing_enabled: row.financing_enabled, financing_plan_ids: row.financing_plan_ids, line_items_n: Array.isArray(row.line_items) ? row.line_items.length : typeof row.line_items, subtotal: row.subtotal, total: row.total, customer_name: row.customer_name, notes: row.notes, updated_at: row.updated_at }, null, 1));
await pool.end();
