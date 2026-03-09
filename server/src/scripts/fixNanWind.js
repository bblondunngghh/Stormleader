import pool from '../db/pool.js';

// Fix NaN values from first backfill run, then re-parse from raw_data.maxWindGust
const { rows } = await pool.query(
  `SELECT id, raw_data->>'maxWindGust' AS gust
   FROM storm_events
   WHERE wind_speed_max_mph = 'NaN'
      OR (wind_speed_max_mph IS NULL AND raw_data->>'maxWindGust' IS NOT NULL)`
);

console.log(`Fixing ${rows.length} records...`);

for (const r of rows) {
  // Extract number from "60 MPH" or "Up to 50 MPH"
  const nums = r.gust ? r.gust.match(/\d+/) : null;
  const speed = nums ? parseFloat(nums[0]) : null;
  await pool.query(
    'UPDATE storm_events SET wind_speed_max_mph = $1 WHERE id = $2',
    [speed, r.id]
  );
}

console.log('Done');
await pool.end();
