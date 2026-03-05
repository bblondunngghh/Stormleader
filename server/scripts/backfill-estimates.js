import pool from '../src/db/pool.js';

const rates = { composition: 5.5, asphalt: 5.5, metal: 8, slate: 12, tile: 9.5, wood: 7 };

const { rows } = await pool.query(`
  SELECT l.id, l.hail_size_in, p.roof_type, p.roof_sqft, p.assessed_value,
         se.wind_speed_max_mph
  FROM leads l
  LEFT JOIN properties p ON p.id = l.property_id
  LEFT JOIN storm_events se ON se.id = l.storm_event_id
  WHERE l.deleted_at IS NULL AND (l.estimated_value IS NULL OR l.estimated_value = 0)
`);

console.log(`${rows.length} leads need estimates`);

for (const r of rows) {
  const hail = r.hail_size_in ? parseFloat(r.hail_size_in) : 0;
  const wind = r.wind_speed_max_mph ? parseFloat(r.wind_speed_max_mph) : 0;

  let df = 0.3;
  if (hail >= 2.5) df = 1.0;
  else if (hail >= 1.75) df = 0.8;
  else if (hail >= 1.25) df = 0.6;
  else if (hail >= 1.0) df = 0.45;
  else if (hail >= 0.75) df = 0.35;
  if (wind >= 80) df = Math.min(df + 0.2, 1.0);
  else if (wind >= 60) df = Math.min(df + 0.1, 1.0);

  let est;
  const sqft = r.roof_sqft ? parseInt(r.roof_sqft) : 0;
  const rate = rates[(r.roof_type || '').toLowerCase()] || 6;
  if (sqft > 0) est = sqft * rate * df;
  else if (r.assessed_value) est = parseFloat(r.assessed_value) * 0.02 * df / 0.6;
  else est = 8500 * df;
  est = Math.round(est / 100) * 100;

  await pool.query('UPDATE leads SET estimated_value = $1 WHERE id = $2', [est, r.id]);
  console.log(`  ${r.id}: $${est}`);
}

console.log('Done');
await pool.end();
