import bcrypt from 'bcryptjs';
import pool from './pool.js';
import logger from '../utils/logger.js';

const AUSTIN_SERVICE_AREA = `SRID=4326;POLYGON((-98.1 30.6, -97.5 30.6, -97.5 30.1, -98.1 30.1, -98.1 30.6))`;

const properties = [
  { address: '4521 Graceland Ln', city: 'Austin', zip: '78731', lat: 30.3521, lng: -97.7567, owner_first: 'Marcus', owner_last: 'Johnson', roof_type: 'composition', roof_sqft: 2800, year_built: 2005, assessed_value: 425000 },
  { address: '1802 Rockmoor Ave', city: 'Austin', zip: '78703', lat: 30.2891, lng: -97.7689, owner_first: 'Sarah', owner_last: 'Chen', roof_type: 'metal', roof_sqft: 3200, year_built: 1998, assessed_value: 520000 },
  { address: '9204 Shady Oaks Dr', city: 'Round Rock', zip: '78681', lat: 30.5217, lng: -97.6789, owner_first: 'David', owner_last: 'Williams', roof_type: 'composition', roof_sqft: 2400, year_built: 2012, assessed_value: 375000 },
  { address: '3307 Pecan Springs Rd', city: 'Austin', zip: '78723', lat: 30.3012, lng: -97.6934, owner_first: 'Jennifer', owner_last: 'Martinez', roof_type: 'composition', roof_sqft: 1900, year_built: 2001, assessed_value: 310000 },
  { address: '6718 Manchaca Rd', city: 'Austin', zip: '78745', lat: 30.2134, lng: -97.7912, owner_first: 'Robert', owner_last: 'Taylor', roof_type: 'tile', roof_sqft: 3500, year_built: 2008, assessed_value: 465000 },
  { address: '11402 Running Brush Ln', city: 'Cedar Park', zip: '78613', lat: 30.5089, lng: -97.8234, owner_first: 'Lisa', owner_last: 'Anderson', roof_type: 'composition', roof_sqft: 2600, year_built: 2015, assessed_value: 390000 },
  { address: '2105 E Riverside Dr', city: 'Austin', zip: '78741', lat: 30.2398, lng: -97.7234, owner_first: 'Michael', owner_last: 'Brown', roof_type: 'composition', roof_sqft: 2100, year_built: 1995, assessed_value: 285000 },
  { address: '8901 Great Hills Trl', city: 'Austin', zip: '78759', lat: 30.4012, lng: -97.7567, owner_first: 'Amanda', owner_last: 'Davis', roof_type: 'slate', roof_sqft: 4200, year_built: 2003, assessed_value: 680000 },
  { address: '5503 Balcones Dr', city: 'Austin', zip: '78731', lat: 30.3456, lng: -97.7612, owner_first: 'James', owner_last: 'Wilson', roof_type: 'composition', roof_sqft: 2900, year_built: 2010, assessed_value: 445000 },
  { address: '1210 W Slaughter Ln', city: 'Austin', zip: '78748', lat: 30.1789, lng: -97.8145, owner_first: 'Emily', owner_last: 'Moore', roof_type: 'metal', roof_sqft: 2300, year_built: 2018, assessed_value: 355000 },
  { address: '7604 Cameron Rd', city: 'Austin', zip: '78752', lat: 30.3398, lng: -97.7023, owner_first: 'Daniel', owner_last: 'Thomas', roof_type: 'composition', roof_sqft: 1800, year_built: 1999, assessed_value: 265000 },
  { address: '4209 Spicewood Springs Rd', city: 'Austin', zip: '78759', lat: 30.4123, lng: -97.7789, owner_first: 'Rachel', owner_last: 'Jackson', roof_type: 'tile', roof_sqft: 3100, year_built: 2007, assessed_value: 510000 },
  { address: '10305 Old Manchaca Rd', city: 'Austin', zip: '78748', lat: 30.1634, lng: -97.8023, owner_first: 'Christopher', owner_last: 'White', roof_type: 'composition', roof_sqft: 2500, year_built: 2014, assessed_value: 385000 },
  { address: '3612 Windsor Rd', city: 'Austin', zip: '78703', lat: 30.2967, lng: -97.7534, owner_first: 'Jessica', owner_last: 'Harris', roof_type: 'composition', roof_sqft: 2700, year_built: 2002, assessed_value: 490000 },
  { address: '8108 Decker Ln', city: 'Austin', zip: '78724', lat: 30.3189, lng: -97.6345, owner_first: 'Kevin', owner_last: 'Clark', roof_type: 'composition', roof_sqft: 2000, year_built: 2011, assessed_value: 295000 },
];

const leads = [
  { propIdx: 0, stage: 'new', priority: 'hot', hail_size: 2.5, value: 18500, insurance: 'State Farm', notes: 'Multiple impacts on north-facing slope' },
  { propIdx: 1, stage: 'contacted', priority: 'hot', hail_size: 2.0, value: 22000, insurance: 'Allstate', notes: 'Standing seam panels dented' },
  { propIdx: 2, stage: 'appt_set', priority: 'warm', hail_size: 1.75, value: 14200, insurance: 'USAA', notes: 'Shingle granule loss observed' },
  { propIdx: 3, stage: 'inspected', priority: 'warm', hail_size: 1.5, value: 12800, insurance: 'Liberty Mutual', notes: 'Soft metal damage on vents and gutters' },
  { propIdx: 4, stage: 'estimate_sent', priority: 'hot', hail_size: 3.0, value: 28500, insurance: 'Farmers', notes: 'Tile cracking throughout, full replacement' },
  { propIdx: 5, stage: 'sold', priority: 'warm', hail_size: 1.75, value: 16200, insurance: 'Progressive', notes: 'Insurance approved, contract signed' },
  { propIdx: 6, stage: 'new', priority: 'cold', hail_size: 1.0, value: 8500, insurance: null, notes: 'Minor damage, homeowner undecided' },
  { propIdx: 7, stage: 'contacted', priority: 'hot', hail_size: 2.75, value: 35000, insurance: 'Chubb', notes: 'Premium slate roof, severe impact damage' },
  { propIdx: 8, stage: 'new', priority: 'warm', hail_size: 1.5, value: 15800, insurance: 'State Farm', notes: 'Ridge cap damage visible from street' },
  { propIdx: 9, stage: 'appt_set', priority: 'warm', hail_size: 1.25, value: 11500, insurance: 'Nationwide', notes: 'Recent install, warranty may apply' },
  { propIdx: 10, stage: 'inspected', priority: 'cold', hail_size: 1.0, value: 9200, insurance: 'Geico', notes: 'Older roof, pre-existing wear noted' },
  { propIdx: 11, stage: 'estimate_sent', priority: 'hot', hail_size: 2.25, value: 24000, insurance: 'Travelers', notes: 'Tile displacement on hip sections' },
  { propIdx: 12, stage: 'sold', priority: 'warm', hail_size: 1.5, value: 14800, insurance: 'State Farm', notes: 'Signed, scheduling crew' },
  { propIdx: 13, stage: 'contacted', priority: 'warm', hail_size: 1.75, value: 19500, insurance: 'Amica', notes: 'High-value home, interested in upgrade' },
  { propIdx: 14, stage: 'new', priority: 'hot', hail_size: 2.0, value: 12000, insurance: 'Erie', notes: 'Extensive damage confirmed by neighbor' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tenant
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (name, slug, subscription_tier, service_area)
       VALUES ($1, $2, $3, ST_GeomFromEWKT($4))
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Creekstone Roof Co', 'creekstone', 'pro', AUSTIN_SERVICE_AREA]
    );
    const tenantId = tenant.id;
    logger.info(`Tenant created: ${tenantId}`);

    // Create users
    const hash = await bcrypt.hash('stormleads123', 10);

    const { rows: [adminUser] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, 'brandon@creekstoneroofco.com', hash, 'Brandon', 'Michaels', 'admin']
    );
    logger.info(`Admin user created: ${adminUser.id}`);

    const { rows: [repUser] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, 'jw@creekstoneroofco.com', hash, 'JW', 'Robertson', 'sales_rep']
    );
    logger.info(`Sales rep created: ${repUser.id}`);

    // Create properties
    const propertyIds = [];
    for (const p of properties) {
      const { rows: [prop] } = await client.query(
        `INSERT INTO properties (location, address_line1, city, state, zip, owner_first_name, owner_last_name, roof_type, roof_sqft, year_built, assessed_value)
         VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, 'TX', $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [p.lng, p.lat, p.address, p.city, p.zip, p.owner_first, p.owner_last, p.roof_type, p.roof_sqft, p.year_built, p.assessed_value]
      );
      propertyIds.push(prop.id);
    }
    logger.info(`Created ${propertyIds.length} properties`);

    // Create leads
    const leadIds = [];
    const reps = [adminUser.id, repUser.id];
    for (let i = 0; i < leads.length; i++) {
      const l = leads[i];
      const p = properties[l.propIdx];
      const { rows: [lead] } = await client.query(
        `INSERT INTO leads (tenant_id, property_id, assigned_rep_id, stage, priority, estimated_value, insurance_company, hail_size_in, contact_name, contact_phone, damage_notes, address, city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          tenantId,
          propertyIds[l.propIdx],
          reps[i % 2],
          l.stage,
          l.priority,
          l.value,
          l.insurance,
          l.hail_size,
          `${p.owner_first} ${p.owner_last}`,
          `(512) 555-${String(1000 + i).slice(-4)}`,
          l.notes,
          p.address,
          p.city,
        ]
      );
      leadIds.push(lead.id);
    }
    logger.info(`Created ${leadIds.length} leads`);

    // Create outreach log entries
    const outreachEntries = [
      { leadIdx: 1, type: 'call', direction: 'outbound', outcome: 'Spoke with homeowner', notes: 'Interested, wants to schedule inspection' },
      { leadIdx: 1, type: 'email', direction: 'outbound', outcome: 'Sent intro email', notes: 'Sent storm damage report and company info' },
      { leadIdx: 2, type: 'call', direction: 'outbound', outcome: 'Set appointment', notes: 'Inspection scheduled for next Tuesday' },
      { leadIdx: 3, type: 'door_knock', direction: 'outbound', outcome: 'Met homeowner', notes: 'Showed damage evidence, performed free inspection' },
      { leadIdx: 4, type: 'email', direction: 'outbound', outcome: 'Sent estimate', notes: 'Full replacement estimate: $28,500' },
      { leadIdx: 5, type: 'call', direction: 'inbound', outcome: 'Contract signed', notes: 'Homeowner called to accept estimate' },
      { leadIdx: 7, type: 'call', direction: 'outbound', outcome: 'Left voicemail', notes: 'Called twice, left VM with storm info' },
      { leadIdx: 13, type: 'sms', direction: 'outbound', outcome: 'Reply received', notes: 'Texted intro, homeowner replied interested' },
    ];

    for (const o of outreachEntries) {
      await client.query(
        `INSERT INTO outreach_log (tenant_id, lead_id, type, direction, outcome, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, leadIds[o.leadIdx], o.type, o.direction, o.outcome, o.notes]
      );
    }
    logger.info(`Created ${outreachEntries.length} outreach log entries`);

    await client.query('COMMIT');
    logger.info('Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
