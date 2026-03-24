# Security Audit — 2026-03-24

## Fixed This Session

1. **Counties route missing authentication** (CRITICAL → FIXED)
   - Added `authenticate` middleware to counties.js
2. **Team role change missing admin check** (HIGH → FIXED)
   - Added admin/super_admin role check to PATCH /team/:userId/role

## Remaining Issues to Address

### Critical
- **Tracerfy webhook** (`webhook.js`): No signature verification — attacker could submit fake skip trace results
- **Hearth webhook** (`hearthWebhook.js`): Signature extracted but not validated

### High
- **Public payment endpoint** (`payments.js`): No rate limiting on payment intent creation
- **Stripe webhook secret**: Should be required in production env validation

### Medium
- **No login rate limiting** (`auth.js`): Brute force protection needed — install `express-rate-limit`
- **Password minimum too short**: Currently 8 chars, recommend 12+
- **Refresh tokens stored unhashed**: Should hash like passwords
- **File upload type validation**: Only checks extension, not MIME type
- **CORS origin**: Should explicitly set domain in production

### Low
- **No admin endpoint rate limiting**: Heavy queries could cause performance issues
- **Numeric input bounds**: limit/offset params should have max bounds

## Passing Checks
- All SQL queries use parameterized `$1, $2` placeholders
- Passwords hashed with bcrypt (10 rounds)
- JWT access tokens expire in 15 minutes, refresh in 7 days
- All CRM/business routes have both authenticate + tenantScope
- .env in .gitignore, no secrets in client code
- No eval()/exec() or dynamic code execution
