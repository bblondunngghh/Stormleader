// Run 76 s1 — fill in the ids the first resolver missed (properties needs bbox,
// storms returns GeoJSON, team returns {members}, contacts live on a lead detail).
import fs from 'fs';
import { req, summarize } from './.qa-r76-lib.mjs';

const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r76-ids.json', 'utf8'));

// properties — bbox is REQUIRED (400 otherwise). Iowa-ish box.
const p = await req('GET', '/api/properties?bbox=-96,40,-90,44&limit=25');
console.log('properties bbox ->', p.status, summarize(p.body));
let prows = Array.isArray(p.body) ? p.body : (p.body?.properties ?? p.body?.features ?? p.body?.data);
if (Array.isArray(prows) && prows.length) {
  ids.property = prows[0].id ?? prows[0].properties?.id;
  console.log('  property id:', ids.property, '| keys:', Object.keys(prows[0]).slice(0, 15).join(','));
}

// storms — GeoJSON FeatureCollection
const s = await req('GET', '/api/storms?limit=20');
const feats = s.body?.features;
console.log('storms ->', s.status, 'features:', feats?.length);
if (Array.isArray(feats) && feats.length) {
  const pr = feats[0].properties || {};
  console.log('  feature props:', Object.keys(pr).slice(0, 20).join(','));
  ids.storm = feats[0].id ?? pr.id ?? pr.event_id;
  ids.stormEventId = pr.id ?? pr.event_id ?? feats[0].id;
}

// team -> { members: [...] }
const t = await req('GET', '/api/crm/team');
const mem = t.body?.members;
console.log('team ->', t.status, 'members:', mem?.length);
if (Array.isArray(mem) && mem.length) {
  console.log('  member keys:', Object.keys(mem[0]).join(','));
  ids.user = mem[0].id ?? mem[0].user_id;
}

// a lead that actually HAS a contact — scan up to 25 leads
const L = await req('GET', '/api/crm/leads?limit=25');
const leads = Array.isArray(L.body) ? L.body : (L.body?.leads ?? L.body?.data ?? []);
console.log('scanning', leads.length, 'leads for a contact...');
for (const l of leads.slice(0, 25)) {
  const d = await req('GET', `/api/crm/leads/${l.id}`);
  const c = d.body?.contacts ?? d.body?.lead?.contacts;
  if (Array.isArray(c) && c.length) {
    ids.contactLead = l.id;
    ids.contact = c[0].id;
    console.log('  found contact on lead', l.id, '->', c[0].id);
    break;
  }
}
if (!ids.contact) console.log('  NO lead in the first 25 has a contact row');

// prospect-list items
if (ids.prospectList && !ids.listPropertyId) {
  const pl = await req('GET', `/api/crm/prospect-lists/${ids.prospectList}/items`);
  console.log('prospect items ->', pl.status, summarize(pl.body));
}

fs.writeFileSync('C:/tmp/qa-r76-ids.json', JSON.stringify(ids, null, 1));
console.log('\nresolved now:', Object.values(ids).filter(Boolean).length, 'of', Object.keys(ids).length);
console.log(Object.entries(ids).filter(([, v]) => !v).map(([k]) => k).join(', '), '<- still missing');
