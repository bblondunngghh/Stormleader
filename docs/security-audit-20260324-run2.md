# Security Audit — 2026-03-24 (Run 2)

## Summary
- **Total routes audited:** ~150+ endpoints across 33 route files
- **Critical:** 0
- **High:** 2 (both FIXED)
- **Medium:** 4 (2 FIXED, 2 noted for future)
- **Low:** 5 (1 FIXED, 4 noted for future)

## FIXED Issues

### HIGH: Unauthenticated trigger-import endpoint
- **File:** server/src/routes/properties.js
- **Issue:** `POST /api/properties/trigger-import` had no auth — anyone could trigger expensive DB imports
- **Fix:** Added `authenticate` middleware

### HIGH: Debug endpoint exposed DB schema
- **File:** server/src/routes/map.js
- **Issue:** `GET /api/map/debug` returned database extensions, table names, columns, row counts
- **Fix:** Removed endpoint entirely

### MEDIUM: Work order milestones not tenant-scoped
- **File:** server/src/routes/workOrders.js
- **Issue:** Milestone GET/PATCH didn't verify work order belonged to tenant
- **Fix:** Added `getWorkOrder(tenantId, id)` ownership check before milestone operations

### MEDIUM: Tenant settings modifiable by any user
- **File:** server/src/routes/crm.js
- **Issue:** `PUT /api/crm/tenant-settings` had no admin role check
- **Fix:** Added admin/super_admin role gate

## Remaining Issues (for future fixes)

### HIGH: Tracerfy webhook has no signature verification
- **File:** server/src/routes/webhook.js
- **Issue:** Accepts tenant_id from request body without HMAC verification
- **Action needed:** Implement webhook signature verification

### MEDIUM: Skip trace job status not tenant-scoped
- **File:** server/src/routes/skipTrace.js
- **Action needed:** Verify jobId belongs to tenant before querying external API

### MEDIUM: Missing Zod validation on mutation endpoints
- Most POST/PUT/PATCH routes do ad-hoc validation instead of Zod schemas
- **Action needed:** Add Zod schemas for all mutation endpoints

## Good Findings (no action needed)
- All passwords hashed with bcrypt (cost 10)
- JWT access tokens expire in 15 minutes, refresh in 7 days
- .env properly gitignored
- Client-side only has publishable keys (Google Maps, Stripe)
- All SQL queries use parameterized placeholders ($1, $2)
- No SQL injection found
- Document uploads validated (25MB limit, extension whitelist)
- Role changes correctly require admin authorization
- Stripe/Hearth webhooks properly verify signatures
