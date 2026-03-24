# Security Audit — 2026-03-24 (Run 3)

## Summary
- **Total routes audited:** 34 route files, ~150+ endpoints
- **Critical:** 0
- **High:** 1 (FIXED)
- **Medium:** 3 (1 FIXED, 2 accepted risk)
- **Low:** 2 (noted)

## FIXED Issues

### HIGH: WKT injection via unvalidated coordinates (territories.js)
- **File:** server/src/routes/territories.js (POST / and PATCH /:id)
- **Issue:** Coordinate arrays from request body were interpolated directly into WKT strings (`POLYGON((...))`) without validating that values were finite numbers. A malicious client could send non-numeric values to produce malformed WKT or exploit PostGIS parsing.
- **Fix:** Added numeric validation (`typeof === 'number'` + `isFinite()`) before WKT string construction in both POST and PATCH routes.

### MEDIUM: Unauthenticated import-progress endpoint (properties.js)
- **File:** server/src/routes/properties.js (GET /import-progress)
- **Issue:** `GET /api/properties/import-progress` had no authentication, exposing import status to unauthenticated users.
- **Fix:** Added `authenticate` middleware.

## Accepted Risk (No Fix Needed)

### MEDIUM: Webhook endpoint without HMAC verification (webhook.js)
- **File:** server/src/routes/webhook.js
- **Issue:** Tracerfy skip-trace webhook accepts `tenant_id` from request body without signature verification. An attacker could forge requests to inject contact data into any tenant.
- **Status:** Accepted risk — Tracerfy does not support HMAC signatures. The endpoint only updates skip-trace results for existing queue entries; no new records are created. Mitigated by the fact that `queue_id` must match an existing pending request.
- **Recommendation:** When Tracerfy adds webhook signatures, implement HMAC verification (like the Hearth webhook pattern).

### MEDIUM: Refresh tokens stored as plaintext in DB (authService.js)
- **File:** server/src/services/authService.js
- **Issue:** Refresh tokens are stored in the `users` table as plaintext. A database breach would expose live refresh tokens.
- **Status:** Accepted risk for now — tokens are short-lived (7 days), and Neon free tier has encryption at rest.
- **Recommendation:** Hash refresh tokens with bcrypt before storage when implementing token rotation.

## Positive Findings

### Authentication & Authorization
- All route files use `authenticate` middleware (except auth.js public routes and webhooks)
- `tenantScope` middleware applied to all tenant-specific data routes
- Admin routes use `authorize('super_admin')` role check
- JWT access tokens expire in 15 minutes; refresh tokens in 7 days

### SQL Injection
- **All queries are parameterized** — no raw string interpolation of user input into SQL
- Dynamic query builders (leads.js, materials.js, canvassing.js) use parameterized `$${idx}` patterns
- Admin route uses column name whitelist for dynamic ORDER BY

### Password Security
- bcrypt with 10 salt rounds for password hashing
- `bcrypt.compare()` for constant-time password verification

### Tenant Isolation
- All CRM routes use `req.tenantId` from `tenantScope` middleware
- Shared data (storms, properties/FEMA, counties) is correctly unscoped — public data visible to all authenticated users
- User-scoped data (notifications) correctly uses `req.user.id`

### Client-Side Security
- No hardcoded API keys or secrets in client source code
- All sensitive values accessed via `import.meta.env.VITE_*`
- `.env` is gitignored

### Code Splitting
- All 33 page-level components use `React.lazy()` in App.jsx
- Proper `Suspense` boundary with `PageLoader` fallback

## Route Coverage Matrix

| Route File | Auth | Tenant Scope | Parameterized | Notes |
|---|---|---|---|---|
| auth.js | Partial (public + /me) | N/A | Yes | By design |
| storms.js | Yes | N/A (shared) | Yes | Public storm data |
| map.js | Yes | N/A (shared) | Yes | Spatial queries |
| properties.js | Yes | N/A (shared) | Yes | FEMA data |
| counties.js | Yes | N/A (shared) | Yes | County data |
| leads.js | Yes + tenantScope | Yes | Yes | Public token routes separated |
| crm.js | Yes + tenantScope | Yes | Yes | |
| dashboard.js | Yes + tenantScope | Yes | Yes | |
| estimates.js | Yes + tenantScope | Yes | Yes | Public view separated |
| invoices.js | Yes + tenantScope | Yes | Yes | |
| contracts.js | Yes + tenantScope | Yes | Yes | Public view separated |
| documents.js | Yes + tenantScope | Yes | Yes | |
| notifications.js | Yes | User-scoped | Yes | |
| search.js | Yes + tenantScope | Yes | Yes | |
| tasks (crm.js) | Yes + tenantScope | Yes | Yes | |
| canvassing.js | Yes + tenantScope | Yes | Yes | |
| territories.js | Yes + tenantScope | Yes | Yes | Coords validated |
| workOrders.js | Yes + tenantScope | Yes | Yes | |
| materials.js | Yes + tenantScope | Yes | Yes | |
| financing.js | Yes + tenantScope | Yes | Yes | |
| payments.js | Yes + tenantScope | Yes | Yes | |
| reports.js | Yes + tenantScope | Yes | Yes | |
| drip.js | Yes + tenantScope | Yes | Yes | |
| content.js | Yes + tenantScope | N/A (no DB) | N/A | |
| expenses.js | Yes + tenantScope | Yes | Yes | |
| subcontractors.js | Yes + tenantScope | Yes | Yes | |
| automations.js | Yes + tenantScope | Yes | Yes | |
| skipTrace.js | Yes + tenantScope | Yes | Yes | |
| roofMeasurement.js | Yes + tenantScope | Yes | Yes | |
| onboarding.js | Yes + tenantScope | Yes | Yes | |
| admin.js | Yes + super_admin | Cross-tenant (by design) | Yes | |
| drift.js | Yes | N/A (shared) | Yes | Storm correction data |
| alerts.js | Yes | Via service layer | Yes | |
| webhook.js | None | Via body | Yes | External webhook |
| hearthWebhook.js | None | Signature verified | Yes | External webhook |
