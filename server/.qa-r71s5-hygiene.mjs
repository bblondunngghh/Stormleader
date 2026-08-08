import pool from './src/db/pool.js';
const q = async (label, sql) => { try { const r = await pool.query(sql); console.log(label, JSON.stringify(r.rows)); } catch(e){ console.log(label, 'ERR', e.message.slice(0,60)); } };
await q('qa2026 tasks:', `SELECT COUNT(*)::int c FROM tasks WHERE title LIKE 'qa2026%'`);
await q('qa probe leads:', `SELECT COUNT(*)::int c FROM leads WHERE first_name LIKE 'qa2026%' OR last_name LIKE 'qa2026%'`);
await q('material_orders total:', `SELECT COUNT(*)::int c FROM material_orders`);
await q('EST-082/083 junk (deliberate):', `SELECT estimate_number, line_items, upgrades, financing_plan_ids FROM estimates WHERE estimate_number IN ('EST-082','EST-083')`);
await q('estimates total:', `SELECT COUNT(*)::int c FROM estimates`);
await q('leads total:', `SELECT COUNT(*)::int c FROM leads`);
await pool.end();
