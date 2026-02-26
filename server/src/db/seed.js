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

const leadData = [
  // Recent leads (this week) — 6 leads
  { propIdx: 0,  stage: 'new',           priority: 'hot',  hail_size: 2.5,  value: 18500, actual: null,  insurance: 'State Farm',     source: 'storm_auto', notes: 'Multiple impacts on north-facing slope', email: 'marcus.j@email.com',       createdAgo: 1,  updatedAgo: 1 },
  { propIdx: 8,  stage: 'new',           priority: 'warm', hail_size: 1.5,  value: 15800, actual: null,  insurance: 'State Farm',     source: 'storm_auto', notes: 'Ridge cap damage visible from street', email: 'jwilson55@gmail.com',       createdAgo: 2,  updatedAgo: 2 },
  { propIdx: 14, stage: 'new',           priority: 'hot',  hail_size: 2.0,  value: 12000, actual: null,  insurance: 'Erie',           source: 'storm_auto', notes: 'Extensive damage confirmed by neighbor', email: 'kclark@gmail.com',        createdAgo: 0,  updatedAgo: 0 },
  { propIdx: 6,  stage: 'new',           priority: 'cold', hail_size: 1.0,  value: 8500,  actual: null,  insurance: null,             source: 'manual',     notes: 'Minor damage, homeowner undecided', email: 'mbrown@email.com',            createdAgo: 3,  updatedAgo: 3 },
  { propIdx: 7,  stage: 'contacted',     priority: 'hot',  hail_size: 2.75, value: 35000, actual: null,  insurance: 'Chubb',          source: 'referral',   notes: 'Premium slate roof, severe impact damage', email: 'amanda.davis@email.com', createdAgo: 5,  updatedAgo: 2 },
  { propIdx: 1,  stage: 'contacted',     priority: 'hot',  hail_size: 2.0,  value: 22000, actual: null,  insurance: 'Allstate',       source: 'storm_auto', notes: 'Standing seam panels dented', email: 'sarah.chen@gmail.com',           createdAgo: 6,  updatedAgo: 3 },
  // Older leads (1-3 weeks ago) — 5 leads
  { propIdx: 2,  stage: 'appt_set',      priority: 'warm', hail_size: 1.75, value: 14200, actual: null,  insurance: 'USAA',           source: 'storm_auto', notes: 'Shingle granule loss observed', email: 'dwilliams@outlook.com',        createdAgo: 14, updatedAgo: 8 },
  { propIdx: 9,  stage: 'appt_set',      priority: 'warm', hail_size: 1.25, value: 11500, actual: null,  insurance: 'Nationwide',     source: 'website',    notes: 'Recent install, warranty may apply', email: 'emoore@outlook.com',         createdAgo: 12, updatedAgo: 6 },
  { propIdx: 3,  stage: 'inspected',     priority: 'warm', hail_size: 1.5,  value: 12800, actual: null,  insurance: 'Liberty Mutual', source: 'door_knock', notes: 'Soft metal damage on vents and gutters', email: 'jmartinez@yahoo.com',   createdAgo: 18, updatedAgo: 10 },
  { propIdx: 10, stage: 'inspected',     priority: 'cold', hail_size: 1.0,  value: 9200,  actual: null,  insurance: 'Geico',          source: 'door_knock', notes: 'Older roof, pre-existing wear noted', email: 'dthomas@email.com',        createdAgo: 21, updatedAgo: 14 },
  { propIdx: 13, stage: 'negotiating',   priority: 'warm', hail_size: 1.75, value: 19500, actual: null,  insurance: 'Amica',          source: 'referral',   notes: 'High-value home, interested in upgrade', email: 'jharris@outlook.com',    createdAgo: 16, updatedAgo: 3 },
  // Mature leads (3-6 weeks ago) — 4 leads (includes sold + lost)
  { propIdx: 4,  stage: 'estimate_sent', priority: 'hot',  hail_size: 3.0,  value: 28500, actual: null,  insurance: 'Farmers',        source: 'storm_auto', notes: 'Tile cracking throughout, full replacement', email: 'rtaylor@email.com',   createdAgo: 25, updatedAgo: 10 },
  { propIdx: 11, stage: 'estimate_sent', priority: 'hot',  hail_size: 2.25, value: 24000, actual: null,  insurance: 'Travelers',      source: 'storm_auto', notes: 'Tile displacement on hip sections', email: 'rjackson@gmail.com',        createdAgo: 22, updatedAgo: 8 },
  { propIdx: 5,  stage: 'sold',          priority: 'warm', hail_size: 1.75, value: 16200, actual: 15800, insurance: 'Progressive',    source: 'storm_auto', notes: 'Insurance approved, contract signed', email: 'lisa.a@gmail.com',         createdAgo: 35, updatedAgo: 7 },
  { propIdx: 12, stage: 'sold',          priority: 'warm', hail_size: 1.5,  value: 14800, actual: 14500, insurance: 'State Farm',     source: 'storm_auto', notes: 'Signed, scheduling crew', email: 'cwhite@email.com',                  createdAgo: 42, updatedAgo: 12 },
  // Lost leads — needed for realistic close rate
  { propIdx: 10, stage: 'lost',          priority: 'cold', hail_size: 1.0,  value: 9200,  actual: null,  insurance: 'Geico',          source: 'door_knock', notes: 'Homeowner went with another contractor', email: 'dthomas2@email.com',     createdAgo: 38, updatedAgo: 15 },
  { propIdx: 6,  stage: 'lost',          priority: 'cold', hail_size: 0.75, value: 6500,  actual: null,  insurance: null,             source: 'manual',     notes: 'Not interested, damage too minor', email: 'nocontact@email.com',           createdAgo: 30, updatedAgo: 20 },
];

// Stagger created_at dates so dashboard week-over-week calcs work
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
  return d.toISOString();
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ============================================================
    // TENANT
    // ============================================================
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (name, slug, subscription_tier, service_area)
       VALUES ($1, $2, $3, ST_GeomFromEWKT($4))
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Creekstone Roof Co', 'creekstone', 'pro', AUSTIN_SERVICE_AREA]
    );
    const tenantId = tenant.id;
    logger.info(`Tenant: ${tenantId}`);

    // ============================================================
    // USERS (3 team members)
    // ============================================================
    const hash = await bcrypt.hash('stormleads123', 10);

    const { rows: [adminUser] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, 'brandon@creekstoneroofco.com', hash, 'Brandon', 'Michaels', 'admin']
    );

    const { rows: [repUser] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, 'jw@creekstoneroofco.com', hash, 'JW', 'Robertson', 'sales_rep']
    );

    const { rows: [rep2User] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, 'maria@creekstoneroofco.com', hash, 'Maria', 'Gonzalez', 'sales_rep']
    );

    const reps = [adminUser.id, repUser.id, rep2User.id];
    logger.info(`Users: admin=${adminUser.id}, rep1=${repUser.id}, rep2=${rep2User.id}`);

    // ============================================================
    // PIPELINE STAGES
    // ============================================================
    const stagesDef = [
      { key: 'new',           label: 'New',            color: 'oklch(0.72 0.19 250)', position: 0, is_won: false, is_lost: false, is_default: true },
      { key: 'contacted',     label: 'Contacted',      color: 'oklch(0.75 0.15 200)', position: 1, is_won: false, is_lost: false, is_default: false },
      { key: 'appt_set',      label: 'Appt Set',       color: 'oklch(0.78 0.17 85)',  position: 2, is_won: false, is_lost: false, is_default: false },
      { key: 'inspected',     label: 'Inspected',      color: 'oklch(0.72 0.20 50)',  position: 3, is_won: false, is_lost: false, is_default: false },
      { key: 'estimate_sent', label: 'Estimate Sent',  color: 'oklch(0.70 0.18 330)', position: 4, is_won: false, is_lost: false, is_default: false },
      { key: 'negotiating',   label: 'Negotiating',    color: 'oklch(0.65 0.15 280)', position: 5, is_won: false, is_lost: false, is_default: false },
      { key: 'sold',          label: 'Sold',           color: 'oklch(0.75 0.18 155)', position: 6, is_won: true,  is_lost: false, is_default: false },
      { key: 'in_production', label: 'In Production',  color: 'oklch(0.72 0.14 250)', position: 7, is_won: false, is_lost: false, is_default: false },
      { key: 'on_hold',       label: 'On Hold',        color: 'oklch(0.55 0.03 260)', position: 8, is_won: false, is_lost: false, is_default: false },
      { key: 'lost',          label: 'Lost',           color: 'oklch(0.50 0.08 25)',  position: 9, is_won: false, is_lost: true,  is_default: false },
    ];

    for (const s of stagesDef) {
      await client.query(
        `INSERT INTO pipeline_stages (tenant_id, key, label, color, position, is_won, is_lost, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT DO NOTHING`,
        [tenantId, s.key, s.label, s.color, s.position, s.is_won, s.is_lost, s.is_default]
      );
    }
    logger.info(`Pipeline stages seeded`);

    // ============================================================
    // PROPERTIES
    // ============================================================
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
    logger.info(`Properties: ${propertyIds.length}`);

    // ============================================================
    // LEADS (with realistic created/updated spread)
    // ============================================================
    const leadIds = [];

    for (let i = 0; i < leadData.length; i++) {
      const l = leadData[i];
      const p = properties[l.propIdx % properties.length];
      const created = daysAgo(l.createdAgo);
      const updated = daysAgo(l.updatedAgo);
      const lastContact = l.stage !== 'new' ? daysAgo(l.updatedAgo + 1) : null;
      const nextFollowUp = ['new', 'contacted', 'appt_set', 'negotiating'].includes(l.stage)
        ? daysAgo(-(1 + Math.floor(Math.random() * 4))) // 1-4 days in the future
        : null;

      const { rows: [lead] } = await client.query(
        `INSERT INTO leads (
           tenant_id, property_id, assigned_rep_id, stage, priority, source,
           estimated_value, actual_value, insurance_company, hail_size_in,
           contact_name, contact_phone, contact_email, damage_notes, address, city,
           last_contact_at, next_follow_up, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [
          tenantId, propertyIds[l.propIdx % propertyIds.length], reps[i % 3],
          l.stage, l.priority, l.source,
          l.value, l.actual, l.insurance, l.hail_size,
          `${p.owner_first} ${p.owner_last}`,
          `(512) 555-${String(1000 + i).slice(-4)}`,
          l.email,
          l.notes, p.address, p.city,
          lastContact, nextFollowUp, created, updated,
        ]
      );
      leadIds.push(lead.id);
    }
    logger.info(`Leads: ${leadIds.length}`);

    // ============================================================
    // CONTACTS (primary + some secondary)
    // ============================================================
    for (let i = 0; i < leadData.length; i++) {
      const p = properties[leadData[i].propIdx];
      await client.query(
        `INSERT INTO contacts (tenant_id, lead_id, first_name, last_name, phone, email, is_primary, source)
         VALUES ($1, $2, $3, $4, $5, $6, true, 'skip_trace')`,
        [tenantId, leadIds[i], p.owner_first, p.owner_last,
         `(512) 555-${String(1000 + i).slice(-4)}`, leadData[i].email]
      );
    }
    // Add a spouse contact to a few leads
    const spouses = [
      { idx: 0, first: 'Diana', last: 'Johnson', phone: '(512) 555-2001' },   // Marcus Johnson
      { idx: 11, first: 'Karen', last: 'Taylor', phone: '(512) 555-2004' },   // Robert Taylor
      { idx: 4, first: 'Tom', last: 'Davis', phone: '(512) 555-2007' },       // Amanda Davis
    ];
    for (const s of spouses) {
      await client.query(
        `INSERT INTO contacts (tenant_id, lead_id, first_name, last_name, phone, is_primary, role, source)
         VALUES ($1, $2, $3, $4, $5, false, 'spouse', 'manual')`,
        [tenantId, leadIds[s.idx], s.first, s.last, s.phone]
      );
    }
    logger.info(`Contacts seeded`);

    // ============================================================
    // ACTIVITIES (realistic CRM timeline)
    // New leadData index mapping:
    //  0=Marcus(new) 1=James(new) 2=Kevin(new) 3=Michael(new)
    //  4=Amanda(contacted) 5=Sarah(contacted) 6=David(appt) 7=Emily(appt)
    //  8=Jennifer(inspected) 9=Daniel(inspected) 10=Jessica(negotiating)
    //  11=Robert(est_sent) 12=Rachel(est_sent)
    //  13=Lisa(sold) 14=Christopher(sold)
    //  15=Daniel(lost) 16=Michael(lost)
    // ============================================================
    const activities = [
      // New leads — system entries
      { leadIdx: 0,  userId: 0, type: 'system',        subject: 'Lead created from storm alert',                       daysAgo: 1 },
      { leadIdx: 2,  userId: 2, type: 'system',        subject: 'Lead created from storm alert',                       daysAgo: 0 },
      // Contacted leads
      { leadIdx: 4,  userId: 0, type: 'call',          subject: 'Outbound call — left voicemail',                      daysAgo: 4, outcome: 'no_answer', duration: 60, direction: 'outbound' },
      { leadIdx: 4,  userId: 0, type: 'call',          subject: 'Second attempt — connected, very interested',         daysAgo: 3, outcome: 'connected', duration: 720, direction: 'outbound' },
      { leadIdx: 4,  userId: 0, type: 'text',          subject: 'Sent damage photos via text',                         daysAgo: 2, direction: 'outbound' },
      { leadIdx: 5,  userId: 1, type: 'call',          subject: 'Outbound call — spoke with homeowner',                daysAgo: 5, outcome: 'connected', duration: 420, direction: 'outbound' },
      { leadIdx: 5,  userId: 1, type: 'email',         subject: 'Sent storm damage report',                            daysAgo: 4, direction: 'outbound' },
      { leadIdx: 5,  userId: 0, type: 'status_change', subject: 'Status changed from New to Contacted',                daysAgo: 4 },
      // Appointment set
      { leadIdx: 6,  userId: 0, type: 'call',          subject: 'Follow-up call — set appointment',                    daysAgo: 10, outcome: 'connected', duration: 300, direction: 'outbound' },
      { leadIdx: 6,  userId: 0, type: 'status_change', subject: 'Status changed from Contacted to Appt Set',           daysAgo: 9 },
      // Inspected
      { leadIdx: 8,  userId: 2, type: 'door_knock',    subject: 'Door knock — met homeowner',                          daysAgo: 14, outcome: 'connected', duration: 1800 },
      { leadIdx: 8,  userId: 2, type: 'note',          subject: 'Inspection notes: soft metal damage on vents, granule loss on south slope', daysAgo: 12 },
      { leadIdx: 8,  userId: 2, type: 'status_change', subject: 'Status changed from Appt Set to Inspected',           daysAgo: 12 },
      // Estimate sent
      { leadIdx: 11, userId: 0, type: 'call',          subject: 'Called to discuss estimate details',                   daysAgo: 15, outcome: 'connected', duration: 600, direction: 'outbound' },
      { leadIdx: 11, userId: 0, type: 'email',         subject: 'Estimate EST-001 sent ($28,500)',                      daysAgo: 12, direction: 'outbound' },
      { leadIdx: 11, userId: 0, type: 'status_change', subject: 'Status changed from Inspected to Estimate Sent',      daysAgo: 12 },
      { leadIdx: 12, userId: 2, type: 'call',          subject: 'Discussed tile replacement options',                   daysAgo: 12, outcome: 'connected', duration: 540, direction: 'outbound' },
      { leadIdx: 12, userId: 2, type: 'email',         subject: 'Estimate sent — full tile replacement',                daysAgo: 10, direction: 'outbound' },
      // Negotiating
      { leadIdx: 10, userId: 0, type: 'call',          subject: 'Price negotiation — homeowner wants upgrade pricing',  daysAgo: 5, outcome: 'connected', duration: 900, direction: 'outbound' },
      { leadIdx: 10, userId: 0, type: 'email',         subject: 'Sent revised estimate with upgrade options',           daysAgo: 3, direction: 'outbound' },
      // Sold leads
      { leadIdx: 13, userId: 1, type: 'call',          subject: 'Inbound call — homeowner accepted estimate',           daysAgo: 8, outcome: 'connected', duration: 480, direction: 'inbound' },
      { leadIdx: 13, userId: 1, type: 'status_change', subject: 'Status changed from Negotiating to Sold',             daysAgo: 8 },
      { leadIdx: 14, userId: 1, type: 'call',          subject: 'Contract signed over phone',                          daysAgo: 14, outcome: 'connected', duration: 360, direction: 'inbound' },
      { leadIdx: 14, userId: 1, type: 'status_change', subject: 'Status changed from Estimate Sent to Sold',           daysAgo: 14 },
      // Lost leads
      { leadIdx: 15, userId: 2, type: 'call',          subject: 'Called — homeowner went with another contractor',      daysAgo: 16, outcome: 'connected', duration: 180, direction: 'outbound' },
      { leadIdx: 15, userId: 2, type: 'status_change', subject: 'Status changed to Lost — went with competitor',       daysAgo: 16 },
      { leadIdx: 16, userId: 1, type: 'door_knock',    subject: 'Door knock — not interested, damage too minor',       daysAgo: 22, outcome: 'connected', duration: 300 },
      { leadIdx: 16, userId: 1, type: 'status_change', subject: 'Status changed to Lost — not interested',             daysAgo: 21 },
      // Recent activity for the feed
      { leadIdx: 1,  userId: 1, type: 'call',          subject: 'Outbound call — no answer',                           daysAgo: 1, outcome: 'no_answer', duration: 30, direction: 'outbound' },
      { leadIdx: 7,  userId: 2, type: 'door_knock',    subject: 'Door knock — spoke with homeowner, appt set',         daysAgo: 1, outcome: 'connected', duration: 1200 },
    ];

    for (const a of activities) {
      const meta = {};
      if (a.direction) meta.direction = a.direction;

      await client.query(
        `INSERT INTO activities (
           tenant_id, lead_id, user_id, type, subject, outcome,
           duration_seconds, metadata, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenantId, leadIds[a.leadIdx], reps[a.userId],
          a.type, a.subject, a.outcome || null,
          a.duration || null,
          Object.keys(meta).length ? JSON.stringify(meta) : null,
          daysAgo(a.daysAgo),
        ]
      );
    }
    logger.info(`Activities: ${activities.length}`);

    // ============================================================
    // TASKS (indices match new leadData order)
    // ============================================================
    const tasks = [
      { leadIdx: 0,    userId: 0, title: 'Call Marcus Johnson — new hot lead',            priority: 'urgent', dueAgo: 0,  desc: 'Storm damage confirmed by neighbor. Call ASAP.' },
      { leadIdx: 6,    userId: 0, title: 'Inspection at 9204 Shady Oaks Dr',              priority: 'high',   dueAgo: -1, desc: 'Appointment set for tomorrow morning.' },
      { leadIdx: 11,   userId: 0, title: 'Follow up on estimate — Robert Taylor',         priority: 'high',   dueAgo: 0,  desc: '$28.5K estimate sent, no response yet.' },
      { leadIdx: 4,    userId: 0, title: 'Send slate repair photos to Amanda Davis',      priority: 'medium', dueAgo: -1, desc: 'She requested examples of our slate work.' },
      { leadIdx: 1,    userId: 1, title: 'Second call attempt — James Wilson',            priority: 'medium', dueAgo: 0,  desc: 'First call went to voicemail yesterday.' },
      { leadIdx: 10,   userId: 0, title: 'Prepare upgrade pricing for Jessica Harris',    priority: 'high',   dueAgo: -1, desc: 'She wants premium shingle upgrade option.' },
      { leadIdx: 12,   userId: 2, title: 'Follow up on tile estimate — Rachel Jackson',   priority: 'medium', dueAgo: 1,  desc: 'Estimate sent, awaiting response.' },
      { leadIdx: null,  userId: 1, title: 'Order marketing materials for door knocking',  priority: 'low',    dueAgo: -3, desc: 'Need new door hangers with updated branding.' },
      { leadIdx: 7,    userId: 2, title: 'Check warranty status — Emily Moore',           priority: 'low',    dueAgo: -2, desc: 'Recent install, may be covered under manufacturer warranty.' },
      // One completed task
      { leadIdx: 13, userId: 1, title: 'Send contract to Lisa Anderson', priority: 'high', dueAgo: 7, desc: 'Contract signed', completed: true },
    ];

    for (const t of tasks) {
      const due = daysAgo(t.dueAgo);
      await client.query(
        `INSERT INTO tasks (
           tenant_id, lead_id, assigned_to, created_by, title, description,
           priority, status, due_date, completed_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          tenantId,
          t.leadIdx !== null ? leadIds[t.leadIdx] : null,
          reps[t.userId],
          reps[0],
          t.title,
          t.desc,
          t.priority,
          t.completed ? 'completed' : 'pending',
          due,
          t.completed ? due : null,
        ]
      );
    }
    logger.info(`Tasks: ${tasks.length}`);

    // ============================================================
    // ESTIMATES
    // ============================================================
    const estimates = [
      {
        leadIdx: 11, userId: 0, number: 'EST-001', status: 'sent',
        customer_name: 'Robert Taylor', customer_address: '6718 Manchaca Rd, Austin TX 78745',
        customer_phone: '(512) 555-1004', customer_email: 'rtaylor@email.com',
        items: [
          { description: 'Tear Off & Replace — Existing Tile Roof', quantity: 35, unit: 'sq', unit_price: 450 },
          { description: 'Synthetic Underlayment', quantity: 35, unit: 'sq', unit_price: 65 },
          { description: 'Ridge Cap — Clay Tile', quantity: 120, unit: 'lf', unit_price: 18 },
          { description: 'Flashing & Sealant', quantity: 1, unit: 'lot', unit_price: 1200 },
          { description: 'Dumpster & Haul-away', quantity: 2, unit: 'ea', unit_price: 650 },
        ],
        scope: 'Complete tear-off and replacement of existing clay tile roof system including underlayment, ridge cap, flashing, and cleanup.',
        terms: 'Payment due upon completion. 50% deposit required to schedule. Insurance claims accepted.',
        warranty: '10-year workmanship warranty. Manufacturer materials warranty as applicable.',
      },
      {
        leadIdx: 12, userId: 2, number: 'EST-002', status: 'sent',
        customer_name: 'Rachel Jackson', customer_address: '4209 Spicewood Springs Rd, Austin TX 78759',
        customer_phone: '(512) 555-1011', customer_email: 'rjackson@gmail.com',
        items: [
          { description: 'Tear Off & Replace — Tile Roof', quantity: 31, unit: 'sq', unit_price: 420 },
          { description: 'Ice & Water Shield', quantity: 10, unit: 'sq', unit_price: 85 },
          { description: 'Ridge Cap', quantity: 90, unit: 'lf', unit_price: 16 },
          { description: 'Pipe Boots & Flashing', quantity: 1, unit: 'lot', unit_price: 900 },
          { description: 'Cleanup & Disposal', quantity: 1, unit: 'lot', unit_price: 1100 },
        ],
        scope: 'Full tile roof replacement including hip and ridge details.',
        terms: 'Net 30 upon completion.',
        warranty: '10-year workmanship warranty.',
      },
      {
        leadIdx: 13, userId: 1, number: 'EST-003', status: 'accepted',
        customer_name: 'Lisa Anderson', customer_address: '11402 Running Brush Ln, Cedar Park TX 78613',
        customer_phone: '(512) 555-1005', customer_email: 'lisa.a@gmail.com',
        items: [
          { description: 'Architectural Shingle Reroof', quantity: 26, unit: 'sq', unit_price: 380 },
          { description: 'Synthetic Underlayment', quantity: 26, unit: 'sq', unit_price: 55 },
          { description: 'Ridge Vent', quantity: 45, unit: 'lf', unit_price: 22 },
          { description: 'Drip Edge', quantity: 180, unit: 'lf', unit_price: 8 },
          { description: 'Cleanup', quantity: 1, unit: 'lot', unit_price: 800 },
        ],
        scope: 'Complete reroof with GAF Timberline HDZ architectural shingles.',
        terms: 'Insurance proceeds assignment accepted.',
        warranty: '25-year GAF System Plus warranty.',
      },
    ];

    for (const est of estimates) {
      const subtotal = est.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const taxAmount = Math.round(subtotal * 0.0825 * 100) / 100;
      const total = subtotal + taxAmount;

      await client.query(
        `INSERT INTO estimates (
           tenant_id, lead_id, created_by, estimate_number, status,
           customer_name, customer_address, customer_phone, customer_email,
           line_items, subtotal, tax_amount, total,
           scope_of_work, terms, warranty_info,
           public_token, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,gen_random_uuid()::text,NOW())`,
        [
          tenantId, leadIds[est.leadIdx], reps[est.userId],
          est.number, est.status,
          est.customer_name, est.customer_address, est.customer_phone, est.customer_email,
          JSON.stringify(est.items), subtotal, taxAmount, total,
          est.scope, est.terms, est.warranty,
        ]
      );
    }
    logger.info(`Estimates: ${estimates.length}`);

    // ============================================================
    // OUTREACH LOG (legacy Phase 1 table)
    // ============================================================
    const outreachEntries = [
      { leadIdx: 1, type: 'call', direction: 'outbound', outcome: 'Spoke with homeowner', notes: 'Interested, wants to schedule inspection' },
      { leadIdx: 2, type: 'call', direction: 'outbound', outcome: 'Set appointment', notes: 'Inspection scheduled for next Tuesday' },
      { leadIdx: 3, type: 'door_knock', direction: 'outbound', outcome: 'Met homeowner', notes: 'Showed damage evidence, performed free inspection' },
      { leadIdx: 5, type: 'call', direction: 'inbound', outcome: 'Contract signed', notes: 'Homeowner called to accept estimate' },
      { leadIdx: 7, type: 'call', direction: 'outbound', outcome: 'Left voicemail', notes: 'Called twice, left VM with storm info' },
    ];

    for (const o of outreachEntries) {
      await client.query(
        `INSERT INTO outreach_log (tenant_id, lead_id, type, direction, outcome, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, leadIds[o.leadIdx], o.type, o.direction, o.outcome, o.notes]
      );
    }
    logger.info(`Outreach log: ${outreachEntries.length}`);

    // ============================================================
    // NOTIFICATION PREFERENCES (for admin user)
    // ============================================================
    const notifTypes = [
      'lead_assigned', 'lead_status_changed', 'task_due_soon', 'task_overdue',
      'estimate_viewed', 'estimate_accepted', 'estimate_declined',
      'storm_alert', 'new_storm_leads', 'mention',
    ];
    for (const nt of notifTypes) {
      await client.query(
        `INSERT INTO notification_preferences (user_id, notification_type, in_app, email, push, email_digest)
         VALUES ($1, $2, true, true, false, 'immediate')
         ON CONFLICT DO NOTHING`,
        [adminUser.id, nt]
      );
    }
    logger.info(`Notification preferences seeded for admin`);

    await client.query('COMMIT');
    logger.info('=== Seed complete ===');
    logger.info(`Login: brandon@creekstoneroofco.com / stormleads123`);
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
