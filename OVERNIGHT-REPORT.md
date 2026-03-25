# StormLeads Overnight Report — March 25, 2026

## Executive Summary

Tonight's session delivered a comprehensive security audit, a new FEMA disaster declarations feature, significant map performance improvements, and a full UI color purge across all mobile views. The competitor research was refreshed with fresh data on all five competitors including the newly discovered QuoteIQ, confirming StormLeads can deliver 90% cost savings over the industry-standard JobNimbus + HailTrace stack.

## Competitor Intelligence

### Market Landscape (5 Competitors Analyzed)

**JobNimbus** remains the dominant CRM at $349–$1,552/month depending on team size and add-ons. They've launched two AI features: AssistAI (phone receptionist at $298/agent/month) and Scout (mobile voice assistant, still in beta). Their pricing is now completely opaque — no published prices, "request pricing" required. User reviews from 2025–2026 cite poor customer support, "finicky" integrations, and growing frustration with hidden costs from required add-ons like CompanyCam and EagleView.

**HailTrace** now has 10,000+ clients (up from 9,000+) at an estimated $83–200+/month depending on tier. Their core hail data comes from the same NOAA MRMS dataset StormLeads already ingests — their differentiation is a team of 15+ meteorologists who hand-verify storms. They've launched a "Raising Hail Tour" for live contractor events, deepening brand loyalty.

**RoofLink** (powered by SalesRabbit) is at $120/user/month, making it $600/month for a 5-person team. In January 2026, SalesRabbit acquired Roofle (roofing e-commerce), creating an end-to-end platform from online quoting to field sales to production. Combined bundle pricing is $160/user/month.

**Rooftops.ai** is the cheapest competitor at just $12/month for 300 AI roof reports, a GPT-5 assistant, and a content studio. They're planning "AI Employees" at $199/month (sales automation, marketing, estimating, insurance). However, they have no CRM, no pipeline, no storm mapping, and no team management.

**QuoteIQ** (new discovery) is an emerging AI-first competitor at $29.99–$399.99/month. They include AI phone calling, photo-based estimating, and outbound cold-calling on all plans. Critically, they have zero storm data or weather mapping — StormLeads' strongest moat.

### What Competitors Charge vs. What We Could Charge

| Scenario | Competitors Combined | StormLeads | Savings |
|---|---|---|---|
| Solo operator (JN + HT) | $432/month | $29/month | 93% |
| 5-person team (JN + HT) | $769/month | $79/month | 90% |
| 10-person team (JN + HT) | $1,454/month | $149/month | 90% |
| 5-person team (RoofLink) | $600/month | $79/month | 87% |

## Pricing Recommendation

### Suggested Tiers

| Tier | Price | Users | Key Inclusions |
|---|---|---|---|
| **Starter** | $29/month | Up to 3 | Full CRM pipeline, estimates with e-sign, invoices with Stripe payments, storm map, 5 workflow automations, basic reports |
| **Professional** | $79/month | Up to 10 | Everything in Starter plus unlimited automations, canvassing with territory management, work orders, calendar, custom fields, financing, PDF reports |
| **Enterprise** | $149/month | Unlimited | Everything in Professional plus priority support, API access, white-label options, AI content tools |

### Why These Prices Work

- **$29 Starter** undercuts QuoteIQ ($29.99) while matching their feature set and adding storm data they don't have
- **$79 Professional** replaces $769/month in combined JobNimbus + HailTrace subscriptions — an irresistible value proposition for 5-person teams
- **$149 Enterprise** delivers unlimited users with no per-seat fees, saving a 10-person team over $15,000/year vs. competitors
- All tiers include features competitors charge extra for: estimates, e-signatures, payments, storm data, automations

## New Features Added

### FEMA Disaster Declarations API
A new county-level disaster risk scoring system powered by FEMA's open data API. When viewing a lead, the system automatically looks up whether the property's county has had federally declared disasters in the past five years. This matters because FEMA-declared disaster zones have higher insurance claim approval rates, making leads in these areas significantly more valuable to roofers. The feature includes a disaster count, most recent declaration date, and risk classification displayed in the lead detail view.

### Polygon-Based Storm Map Property Loading
The storm map now uses server-side polygon intersection to load properties, replacing the old bounding-box approach. Previously, viewing an elongated storm swath would load properties from a massive rectangular area — wasting API calls and displaying irrelevant buildings. Now, only properties physically within the storm polygon are loaded. This dramatically reduces unnecessary data transfer and makes the map faster and more accurate.

### WorkOrdersView Empty State
Work Orders now shows a guided empty state with a clear message and action button when no work orders exist, instead of a blank screen. This improves the new-user experience by showing them what the feature does and how to get started.

## UI Improvements

### Hex Color Purge — All Mobile Views
Dashboard, Pipeline, Estimates, Tasks, and Storm Map views all had hardcoded hex colors (`#ffffff`, `#3b82f6`, etc.) that broke theme consistency. All were replaced with oklch color values and CSS custom properties, ensuring consistent appearance across dark and light modes. This affects every major view users see on mobile devices.

### BottomTabBar Color Fix
The mobile bottom navigation bar had three remaining hex color values for text, active state, and background. These were replaced with CSS variable references to match the design system. The tab bar now correctly responds to theme changes.

### Modal Animation Consistency
Six components (EmailModal, EstimatesView, ExpensesView, InvoicesView, MaterialsView, SettingsView) were missing the `modal-backdrop` CSS class on their overlay elements. Adding this class ensures all modals throughout the application use the same scale-in animation and backdrop blur, creating a polished, consistent feel when opening any modal.

## Security Improvements

### Full Route Audit
All 36 route files in the server were audited for authentication, tenant isolation, SQL injection, and secret exposure. Results:
- 100% of protected routes have authentication middleware
- 100% of data routes enforce tenant isolation
- 100% of SQL queries are parameterized (no injection risks found)
- No secrets in client-side code
- Passwords hashed with bcrypt (10 rounds)
- JWTs configured with proper expiration (15-minute access, 7-day refresh)

### N+1 Query Fix
The notification broadcast function was executing individual INSERT queries in a loop — one per team member per notification. This was converted to a single bulk INSERT...SELECT query, reducing database round trips from N to 1. Critical for the Neon free tier's connection limits.

### Missing Database Indexes
Seven missing indexes were identified and added via a new migration:
- Properties, leads, contacts, and drip enrollment tables now have proper indexes on foreign keys and common query patterns. These prevent full table scans on the most frequently queried tables.

## Product Recommendations

### Top 5 High-Impact Features to Build Next

1. **Historical Storm Archive (SPC SVRGIS)** — Import 70+ years of free storm history data from NOAA. This closes the single biggest competitive gap vs. HailTrace and enables a "Honey Hole Finder" that identifies neighborhoods with recurring storm damage. The data is freely available as shapefiles.

2. **Lead Scoring Algorithm** — Combine storm history frequency, home age, ownership rate, home value, proximity to recent storms, FEMA declaration status, and tree canopy risk into a composite score. No competitor offers algorithmic lead scoring — this would be a genuine differentiator.

3. **Census Demographics Integration** — Pull median home age, ownership rate, income, and home value by census block group using the free Census ACS API. This data powers the lead scoring algorithm and helps roofers identify premium neighborhoods.

4. **QuickBooks Sync** — Both JobNimbus and RoofLink offer this. The QuickBooks API has a free tier for small applications. Start with basic invoice sync (push invoices to QB when created in StormLeads).

5. **SMS Appointment Reminders** — Texting is the #1 communication channel for field contractors. Twilio costs about $0.0075 per message. Pass the cost through to users or include a small monthly allocation in paid tiers.

### Free Data Sources to Integrate Next

| Source | What It Provides | Effort |
|---|---|---|
| SPC SVRGIS Archive | 70+ years of storm history shapefiles | 1–2 days |
| Census ACS API | Home age, ownership, income by block group | 1–2 days |
| FEMA Housing Assistance | Verified damage counts by ZIP code | Half day |
| Overture Maps Footprints | 2.3B building footprints with metadata | 1–2 days |
| NAIP Aerial Imagery | 60cm resolution aerial photos, entire US | 1–2 days |
| US Census Geocoder | Free batch geocoding (10K addresses) | Half day |

## Still Needs Attention

### Items Not Fixed (and Why)

**No login rate limiting** — The authentication endpoint accepts unlimited login attempts. Adding express-rate-limit is straightforward but was deferred because it requires choosing rate limits that won't block legitimate users with multiple devices. Recommend adding a 10-attempt-per-minute limit per IP.

**Refresh tokens stored unhashed** — Refresh tokens are stored in plaintext in the database. If the database were compromised, attackers could use these tokens to generate new access tokens. Hashing refresh tokens (like passwords) would mitigate this. Deferred because it requires a migration and changes to the token verification flow.

**Remaining N+1 query patterns** — Three functions still execute queries in loops: storm-to-lead generation, lead scoring, and drip sequence step processing. These work fine at current scale but will become bottlenecks with larger datasets. Each needs to be refactored to use bulk queries.

**No unified dashboard loading skeleton** — The dashboard loads each section independently with scattered loading spinners. A unified skeleton screen (gray shimmering placeholders) would feel much more polished. This is a visual improvement only — no functionality impact.

**Tracerfy webhook has no signature verification** — The webhook endpoint from Tracerfy (weather alert service) accepts any POST request without verifying a signature header. Low risk since it's an internal service, but should be hardened before production launch.

### Priorities for Next Session

1. Import SPC SVRGIS historical storm archive into PostGIS
2. Build lead scoring algorithm using existing data sources + FEMA declarations
3. Add Census ACS demographics API integration
4. Add login rate limiting
5. Hash refresh tokens in database
6. Convert remaining N+1 queries to bulk operations
7. Add dashboard loading skeleton
