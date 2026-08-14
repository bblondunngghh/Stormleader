import pool from './src/db/pool.js';
const { rows } = await pool.query(`
  SELECT id, estimate_number, jsonb_typeof(line_items) AS t,
         jsonb_array_length(CASE WHEN jsonb_typeof(line_items)='array' THEN line_items ELSE '[]'::jsonb END) AS len,
         line_items::text AS raw
  FROM estimates
  WHERE jsonb_typeof(line_items) <> 'array'
     OR line_items @> '[null]'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(line_items)='array' THEN line_items ELSE '[]'::jsonb END) e
        WHERE jsonb_typeof(e) <> 'object')
  ORDER BY estimate_number`);
console.log('estimates with non-object line_item elements:', rows.length);
rows.forEach(r => console.log(` ${r.estimate_number} id=${r.id} type=${r.t} len=${r.len} raw=${r.raw.slice(0,90)}`));
await pool.end();
