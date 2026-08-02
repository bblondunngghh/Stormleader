// Run 65 — Axis B (static, exhaustive): every route handler that accepts a user-supplied
// :id param must reference req.tenantId (directly, or via a helper that gates on it).
// Zero DB writes. Complements the runtime cross-tenant spot-checks.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Projects/stormleads/server/src/routes';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'index.js');

// Routers that are legitimately NOT tenant-scoped:
//  - global public datasets (NOAA storms, FEMA, census, counties)
//  - platform-admin (scoped by role, operates ACROSS tenants by design)
//  - unauthenticated public/webhook surfaces
const GLOBAL_ROUTERS = new Set([
  'storms.js', 'stormHistory.js', 'disasterDeclarations.js', 'dataApis.js',
  'counties.js', 'map.js', 'drift.js', 'properties.js', 'admin.js',
  'webhook.js', 'hearthWebhook.js', 'onboarding.js',
]);

const rows = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  // match router.<verb>('<path>', ...middleware..., async (req,res,next) => { ... })
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]([\s\S]*?)\n\}\);/g;
  let m;
  while ((m = re.exec(src))) {
    const [, verb, rpath, body] = m;
    if (!/:[A-Za-z0-9_]+/.test(rpath)) continue; // only routes with a user-supplied param
    const isPublic = /\/public\//.test(rpath) || /public/.test(rpath);
    const usesTenant = /req\.tenantId|tenantId/.test(body);
    const usesUser = /req\.user\.id|req\.user\?\.id|userId/.test(body);
    rows.push({
      file: f, verb: verb.toUpperCase(), path: rpath,
      usesTenant, usesUser, isPublic,
      global: GLOBAL_ROUTERS.has(f),
    });
  }
}

const suspects = rows.filter((r) => !r.usesTenant && !r.usesUser && !r.isPublic && !r.global);
const scoped = rows.filter((r) => r.usesTenant);
const byUser = rows.filter((r) => !r.usesTenant && r.usesUser);

console.log('AXIS B — TENANT SCOPING (static, all :id routes)');
console.log(`param routes scanned = ${rows.length}`);
console.log(`  scoped by req.tenantId ............ ${scoped.length}`);
console.log(`  scoped by req.user.id only ........ ${byUser.length}`);
console.log(`  public/global (by design) ......... ${rows.filter((r) => r.isPublic || r.global).length}`);
console.log(`  UNSCOPED SUSPECTS ................. ${suspects.length}`);
if (suspects.length) {
  console.log('\n--- SUSPECTS (need manual read) ---');
  for (const s of suspects) console.log(`${s.verb}\t${s.path}\t[${s.file}]`);
}
if (byUser.length) {
  console.log('\n--- scoped by user id only (verify id comes from JWT not params) ---');
  for (const s of byUser) console.log(`${s.verb}\t${s.path}\t[${s.file}]`);
}
fs.writeFileSync('C:/tmp/r65-tenant-scope.json', JSON.stringify({ suspects, byUser, total: rows.length }, null, 1));
