import { req } from './.qa-r76-lib.mjs';
const paths = [
  '/api/crm/calendar',
  '/api/data/directions?origin=42.49,-92.34&destination=42.51,-92.44',
  '/api/disaster-declarations?state=IA',
  '/api/disaster-declarations',
  '/api/properties/fema-live',
  '/api/properties/reverse-geocode',
];
for (const p of paths) {
  const r = await req('GET', p);
  console.log(String(r.status).padEnd(5), p, '\n     ', JSON.stringify(r.body).slice(0, 300), '\n');
}
