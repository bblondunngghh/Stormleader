import pool from '../db/pool.js';

await pool.query(`DROP VIEW IF EXISTS lead_summary_view`);
await pool.query(`CREATE VIEW lead_summary_view AS
SELECT
  l.id, l.tenant_id, l.stage, l.priority, l.estimated_value, l.actual_value,
  l.source, l.tags, l.address, l.city, l.hail_size_in, l.insurance_company,
  l.contact_name, l.contact_phone, l.contact_email,
  l.last_contact_at, l.next_follow_up, l.notes, l.lost_reason,
  l.created_at, l.updated_at, l.deleted_at,
  l.property_id, l.storm_event_id, l.assigned_rep_id,
  pc.first_name AS contact_first_name, pc.last_name AS contact_last_name,
  pc.phone AS primary_phone, pc.email AS primary_email,
  u.first_name AS rep_first_name, u.last_name AS rep_last_name, u.email AS rep_email,
  p.roof_type, p.roof_sqft, p.year_built,
  p.assessed_value AS property_value, p.address_line1 AS property_address,
  p.state AS property_state, p.zip AS property_zip,
  se.hail_size_max_in AS storm_hail_max, se.wind_speed_max_mph AS storm_wind_max,
  se.event_start AS storm_date,
  la.latest_activity_at, la.latest_activity_type
FROM leads l
LEFT JOIN LATERAL (
  SELECT first_name, last_name, phone, email FROM contacts
  WHERE contacts.lead_id = l.id AND contacts.is_primary = true LIMIT 1
) pc ON true
LEFT JOIN users u ON u.id = l.assigned_rep_id
LEFT JOIN properties p ON p.id = l.property_id
LEFT JOIN storm_events se ON se.id = l.storm_event_id
LEFT JOIN LATERAL (
  SELECT created_at AS latest_activity_at, type AS latest_activity_type FROM activities
  WHERE activities.lead_id = l.id ORDER BY created_at DESC LIMIT 1
) la ON true`);

console.log('View updated successfully');
await pool.end();
