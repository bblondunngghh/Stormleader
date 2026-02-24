// ---- Mock Data for StormLeads CRM ----

export const stats = [
  { label: 'Pipeline Value', value: '$127K', change: '+12%', icon: 'dollar', color: 'oklch(0.75 0.18 155)' },
  { label: 'New Leads', value: '47', change: '+8', icon: 'leads', color: 'oklch(0.72 0.19 250)' },
  { label: 'Close Rate', value: '34%', change: '+2.1%', icon: 'target', color: 'oklch(0.78 0.17 85)' },
  { label: 'Avg Days to Close', value: '12', change: '-3', icon: 'clock', color: 'oklch(0.70 0.18 330)' },
];

export const pipelineColumns = [
  { id: 'new', label: 'New', color: 'oklch(0.72 0.19 250)' },
  { id: 'contacted', label: 'Contacted', color: 'oklch(0.75 0.15 200)' },
  { id: 'appt-set', label: 'Appt Set', color: 'oklch(0.78 0.17 85)' },
  { id: 'inspected', label: 'Inspected', color: 'oklch(0.72 0.20 50)' },
  { id: 'estimate-sent', label: 'Estimate Sent', color: 'oklch(0.70 0.18 330)' },
  { id: 'sold', label: 'Sold', color: 'oklch(0.75 0.18 155)' },
];

export const leads = [
  { id: 1, name: 'Marcus Johnson', address: '4821 Ridgeview Dr', city: 'Round Rock', hailSize: '1.75"', value: 14200, priority: 'hot', rep: 'BL', stage: 'new', phone: '(512) 555-0147', email: 'marcus.j@email.com', roofType: 'Asphalt Shingle', sqft: 2400, stories: 2, insuranceCo: 'State Farm', claimNumber: 'SF-2026-44821', stormDate: '2026-02-18', damageNotes: 'Multiple broken shingles on south-facing slope, gutter dents, cracked ridge cap' },
  { id: 2, name: 'Sarah Chen', address: '1203 Willow Creek Blvd', city: 'Cedar Park', hailSize: '1.50"', value: 11800, priority: 'hot', rep: 'BL', stage: 'new', phone: '(512) 555-0293', email: 'schen@email.com', roofType: 'Asphalt Shingle', sqft: 1950, stories: 1, insuranceCo: 'Allstate', claimNumber: null, stormDate: '2026-02-18', damageNotes: 'Widespread granule loss, 3 cracked shingles visible from ground' },
  { id: 3, name: 'David & Lisa Morales', address: '782 Sunset Canyon Trl', city: 'Austin', hailSize: '2.00"', value: 22500, priority: 'hot', rep: 'JW', stage: 'new', phone: '(512) 555-0381', email: 'dmorales@email.com', roofType: 'Tile', sqft: 3200, stories: 2, insuranceCo: 'USAA', claimNumber: 'USAA-2026-10482', stormDate: '2026-02-18', damageNotes: 'Broken tiles on west slope, underlayment exposed in two areas' },
  { id: 4, name: 'Tom Wheeler', address: '335 Pecan Grove Ln', city: 'Georgetown', hailSize: '1.25"', value: 9400, priority: 'warm', rep: 'BL', stage: 'contacted', phone: '(512) 555-0429', email: 'twheeler@email.com', roofType: 'Asphalt Shingle', sqft: 1800, stories: 1, insuranceCo: 'Farmers', claimNumber: null, stormDate: '2026-02-15', damageNotes: 'Soft spots on north slope, minor granule loss' },
  { id: 5, name: 'Patricia Dunn', address: '1547 Magnolia Springs Dr', city: 'Pflugerville', hailSize: '1.50"', value: 16100, priority: 'warm', rep: 'JW', stage: 'contacted', phone: '(512) 555-0517', email: 'pdunn@email.com', roofType: 'Metal Standing Seam', sqft: 2100, stories: 1, insuranceCo: 'Liberty Mutual', claimNumber: 'LM-449201', stormDate: '2026-02-15', damageNotes: 'Dents on exposed metal panels, cosmetic damage to fascia' },
  { id: 6, name: 'James & Rita Okonkwo', address: '990 Bluebonnet Hill Ct', city: 'Austin', hailSize: '1.75"', value: 18900, priority: 'hot', rep: 'BL', stage: 'contacted', phone: '(512) 555-0628', email: 'jokonkwo@email.com', roofType: 'Asphalt Shingle', sqft: 2800, stories: 2, insuranceCo: 'State Farm', claimNumber: 'SF-2026-51002', stormDate: '2026-02-18', damageNotes: 'Adjuster already approved, needs contractor estimate ASAP' },
  { id: 7, name: 'Michelle Tran', address: '2215 Stone Oak Pass', city: 'Round Rock', hailSize: '1.50"', value: 13600, priority: 'warm', rep: 'JW', stage: 'appt-set', phone: '(512) 555-0734', email: 'mtran@email.com', roofType: 'Asphalt Shingle', sqft: 2200, stories: 1, insuranceCo: 'Allstate', claimNumber: 'AL-20260221-7741', stormDate: '2026-02-18', damageNotes: 'Inspection scheduled for 2/26. Homeowner reported leaks in master bedroom.' },
  { id: 8, name: 'Robert Fitzgerald', address: '418 Cedar Elm Way', city: 'Leander', hailSize: '2.00"', value: 24300, priority: 'hot', rep: 'BL', stage: 'appt-set', phone: '(512) 555-0845', email: 'rfitz@email.com', roofType: 'Tile', sqft: 3500, stories: 2, insuranceCo: 'Nationwide', claimNumber: null, stormDate: '2026-02-18', damageNotes: 'Large hail confirmed by neighbor photos. Appt 2/25 at 10am.' },
  { id: 9, name: 'Angela Reyes', address: '603 Barton Hills Dr', city: 'Austin', hailSize: '1.75"', value: 15800, priority: 'warm', rep: 'JW', stage: 'inspected', phone: '(512) 555-0951', email: 'areyes@email.com', roofType: 'Asphalt Shingle', sqft: 2350, stories: 2, insuranceCo: 'USAA', claimNumber: 'USAA-2026-11293', stormDate: '2026-02-15', damageNotes: 'Inspection complete. 47 hits on south slope test square. Recommending full replacement.' },
  { id: 10, name: 'Kevin & Diane Park', address: '1876 Trails End Rd', city: 'Cedar Park', hailSize: '1.50"', value: 12700, priority: 'cold', rep: 'BL', stage: 'inspected', phone: '(512) 555-1062', email: 'kpark@email.com', roofType: 'Asphalt Shingle', sqft: 2000, stories: 1, insuranceCo: 'Farmers', claimNumber: 'FR-2026-08844', stormDate: '2026-02-15', damageNotes: 'Inspection complete. Borderline damage — may not meet threshold. Follow up with adjuster.' },
  { id: 11, name: 'Stephanie Brooks', address: '2504 Arbor Vitae Cir', city: 'Austin', hailSize: '1.75"', value: 17400, priority: 'warm', rep: 'JW', stage: 'estimate-sent', phone: '(512) 555-1178', email: 'sbrooks@email.com', roofType: 'Asphalt Shingle', sqft: 2600, stories: 2, insuranceCo: 'State Farm', claimNumber: 'SF-2026-52481', stormDate: '2026-02-18', damageNotes: 'Estimate sent 2/22. Waiting on homeowner approval. Insurance approved claim for $16,200.' },
  { id: 12, name: 'Carlos Mendez', address: '731 Live Oak Ranch Rd', city: 'Georgetown', hailSize: '2.00"', value: 28600, priority: 'hot', rep: 'BL', stage: 'estimate-sent', phone: '(512) 555-1284', email: 'cmendez@email.com', roofType: 'Metal Standing Seam', sqft: 2900, stories: 1, insuranceCo: 'Liberty Mutual', claimNumber: 'LM-450112', stormDate: '2026-02-18', damageNotes: 'Premium metal roof replacement. Estimate sent, homeowner comparing 2 contractors.' },
  { id: 13, name: 'Brenda Walsh', address: '155 Cypress Mill Rd', city: 'Lakeway', hailSize: '1.75"', value: 19200, priority: 'warm', rep: 'JW', stage: 'estimate-sent', phone: '(512) 555-1391', email: 'bwalsh@email.com', roofType: 'Asphalt Shingle', sqft: 2450, stories: 2, insuranceCo: 'Nationwide', claimNumber: 'NW-2026-33150', stormDate: '2026-02-15', damageNotes: 'Estimate sent 2/20. Homeowner asked about upgrade to architectural shingles.' },
  { id: 14, name: 'Alan & Joyce Kessler', address: '3019 Falcon Heights Blvd', city: 'Round Rock', hailSize: '1.50"', value: 13100, priority: 'hot', rep: 'BL', stage: 'sold', phone: '(512) 555-1506', email: 'akessler@email.com', roofType: 'Asphalt Shingle', sqft: 2150, stories: 1, insuranceCo: 'Allstate', claimNumber: 'AL-20260219-8102', stormDate: '2026-02-15', damageNotes: 'SOLD. Install scheduled 3/3. Materials ordered. GAF Timberline HDZ - Charcoal.' },
  { id: 15, name: 'Nina Okafor', address: '892 Westlake Terrace', city: 'Austin', hailSize: '2.00"', value: 31200, priority: 'hot', rep: 'JW', stage: 'sold', phone: '(512) 555-1617', email: 'nokafor@email.com', roofType: 'Tile', sqft: 3800, stories: 2, insuranceCo: 'USAA', claimNumber: 'USAA-2026-12001', stormDate: '2026-02-18', damageNotes: 'SOLD. Premium tile reroof. Install crew scheduled week of 3/10. Deposit received.' },
];

export const activityFeed = [
  { id: 1, type: 'sold', text: 'Nina Okafor — Sold $31.2K tile reroof', time: '2h ago' },
  { id: 2, type: 'estimate', text: 'Carlos Mendez — Estimate sent ($28.6K)', time: '4h ago' },
  { id: 3, type: 'appointment', text: 'Robert Fitzgerald — Appt confirmed 2/25 10am', time: '5h ago' },
  { id: 4, type: 'lead', text: 'David & Lisa Morales — New lead from storm canvass', time: '6h ago' },
  { id: 5, type: 'inspection', text: 'Angela Reyes — Inspection complete, 47 hits', time: '8h ago' },
  { id: 6, type: 'sold', text: 'Alan & Joyce Kessler — Sold $13.1K, install 3/3', time: '1d ago' },
  { id: 7, type: 'call', text: 'Patricia Dunn — Follow-up call, interested in metal', time: '1d ago' },
  { id: 8, type: 'lead', text: 'Sarah Chen — New lead via website quote tool', time: '1d ago' },
];

export const funnelData = [
  { stage: 'New', count: 3, value: 48500, color: 'oklch(0.72 0.19 250)' },
  { stage: 'Contacted', count: 3, value: 44400, color: 'oklch(0.75 0.15 200)' },
  { stage: 'Appt Set', count: 2, value: 37900, color: 'oklch(0.78 0.17 85)' },
  { stage: 'Inspected', count: 2, value: 28500, color: 'oklch(0.72 0.20 50)' },
  { stage: 'Est. Sent', count: 3, value: 65200, color: 'oklch(0.70 0.18 330)' },
  { stage: 'Sold', count: 2, value: 44300, color: 'oklch(0.75 0.18 155)' },
];

export const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'pipeline', label: 'Pipeline', icon: 'columns' },
  { id: 'leads', label: 'Leads', icon: 'users' },
  { id: 'storm-map', label: 'Storm Map', icon: 'map' },
  { id: 'tasks', label: 'Tasks', icon: 'check-square' },
  { id: 'estimates', label: 'Estimates', icon: 'file-text' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
