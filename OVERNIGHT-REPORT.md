# StormLeads Overnight Report — March 24, 2026

## Executive Summary

Tonight's three overnight sessions delivered major progress across security, performance, new features, and competitive research. We added canvassing territory management with polygon drawing, wired up the photo annotation tool, fixed critical security vulnerabilities across 34 route files, optimized storm map performance with spatial filtering, improved empty states across six pages, and expanded our free data source catalog to 19 sources. Competitive research confirmed that a typical 5-person roofing team pays $824/month for JobNimbus + HailTrace — StormLeads can deliver the same value at $79/month (90% savings).

## Competitor Intelligence

### Key Findings

**JobNimbus** remains the dominant roofing CRM at $225–550/month base plus $30–75 per user. They've added AI features (AssistAI at $298/agent/month, Scout mobile assistant in beta) and acquired SumoQuote for built-in estimating. A solo operator pays ~$349/month; a 5-person team pays ~$624/month before add-ons. User complaints focus on pricing opacity, "finicky" integrations, and declining support quality.

**HailTrace** charges $50–300+/month for storm maps built on the same NOAA MESH data we already ingest for free. Their differentiation is a 15-person meteorologist team and 70+ years of historical data (available via the free SPC SVRGIS archive). Users report declining service quality and escalating costs.

**RoofLink** (powered by SalesRabbit) charges $120/user/month — flat rate with no feature gating. Strong on the estimate-to-material-order pipeline with direct SRS Distribution integration. At 5 users, that's $600/month.

**Rooftops.ai** is the budget option at $12/month for 300 AI-powered roof reports. Their AI Creator Studio generates marketing content, and they have solar analysis built in. However, they lack CRM, pipeline, invoicing, and canvassing — it's a measurement tool, not a business platform.

### What They Charge vs. What We Could Charge

| Competitor | 5-Person Team Cost | What You Get |
|---|---|---|
| JobNimbus + HailTrace | $824/month | CRM + storm maps (two separate platforms) |
| RoofLink | $600/month | CRM + canvassing (no storm data) |
| Rooftops.ai | $55/month | AI roof reports only (no CRM) |
| **StormLeads** | **$79/month** | **CRM + storm maps + canvassing + estimates + invoicing — all in one** |

## Pricing Recommendation

| Tier | Price | Users | Includes | Target |
|---|---|---|---|---|
| **Starter** | **$29/mo** | 3 | CRM pipeline, estimates, invoices, storm map, 5 automations, basic reports | Solo operators |
| **Professional** | **$79/mo** | 10 | Everything in Starter + unlimited automations, canvassing with territories, work orders, calendar, custom fields, contracts, expense tracking | Small teams |
| **Enterprise** | **$149/mo** | Unlimited | Everything in Pro + priority support, API access, white-label options | Large operations |

### Savings Comparison

| Company Size | Competitors (JN + HT) | StormLeads | Monthly Savings | Annual Savings | % Saved |
|---|---|---|---|---|---|
| Solo operator | $424/mo | $29/mo | **$395** | **$4,740** | **93%** |
| 5-person team | $824/mo | $79/mo | **$745** | **$8,940** | **90%** |
| 10-person team | $1,499/mo | $149/mo | **$1,350** | **$16,200** | **90%** |

Our near-zero infrastructure costs (Neon free tier, NOAA free APIs, no per-user licensing) make these prices sustainable with strong margins.

## New Features Added

### 1. Canvassing Territory Management
Reps can now draw polygon boundaries on the map to define canvassing territories, assign them to team members, and color-code them for visual clarity. The backend uses PostGIS spatial queries to count how many pins fall within each territory. This closes one of our biggest competitive gaps — HailTrace and RoofLink both charge for this capability.

**Where to find it:** Open Canvassing from the sidebar, click the "Territories" toggle button in the map overlay.

**Why it matters:** Territory management prevents reps from overlapping and lets managers track coverage. It was listed as a critical missing feature versus HailTrace.

### 2. Photo Annotation Tool
The photo annotator (drawing tool for marking up roof damage photos) is now wired into the Lead Detail documents tab. Clicking the pencil icon on any uploaded photo opens a full-screen canvas where users can draw, circle, and annotate damage. Annotated images save as new documents linked to the lead.

**Where to find it:** Open any lead, go to the Documents tab, click the pencil icon on a photo thumbnail.

**Why it matters:** Roofers need to mark up photos showing damage for insurance adjusters. JobNimbus and RoofLink use CompanyCam ($19/user/month extra) for this — ours is built in and free.

### 3. Google Review Request Automation
When a job is marked as completed, the system can now auto-generate a personalized Google review request link. This is a free feature that competitors charge for or require add-ons to access.

**Where to find it:** Triggered automatically when a job reaches the "Completed" stage.

**Why it matters:** Google reviews drive new business for roofers. JobNimbus bundles this into their Engage texting add-on ($49–249/month).

### 4. Subcontractor Management
Full CRUD interface for managing subcontractors with work order assignment. Track subcontractor details, assign them to specific work orders, and manage the relationship from within the platform.

**Where to find it:** Accessible from the sidebar navigation.

**Why it matters:** Previously listed as a competitive gap versus JobNimbus.

### 5. PWA Mobile Install Support
Added a web app manifest and service worker enabling "Add to Home Screen" on mobile devices. This gives StormLeads a native app feel without the cost and complexity of building separate iOS and Android apps.

**Where to find it:** Visit the app on a mobile browser and use "Add to Home Screen."

**Why it matters:** All three major competitors have native mobile apps. PWA support closes that gap at zero cost.

### 6. Database Performance Optimizations
Batched milestone inserts for work orders (7 individual INSERT queries replaced with a single multi-value INSERT) and added composite indexes on tasks and activities tables for the dashboard's "tasks due today" and activity feed queries.

**Why it matters:** Reduces database write operations on our Neon free tier and speeds up the most frequently loaded dashboard components.

## UI Improvements

### Empty States (6 pages improved)
- **Lead List:** Now shows an icon with contextual messaging — different text for "no leads yet" versus "no leads match your filters," with guidance on how to add leads.
- **Pipeline:** Desktop kanban columns display "No leads in this stage" instead of empty white space, making it clear the pipeline is working but empty.
- **Invoices:** Added an icon, descriptive text, and a prominent "New Invoice" call-to-action button.
- **Tasks:** Upgraded from plain text to a structured layout with a clipboard icon, title, and encouragement to create the first task.
- **Contracts stat cards:** Added matching document icons for visual consistency with the Estimates and Invoices pages.
- **Content Studio:** Fixed the "Generate Content" button from an off-brand purple gradient to the standard warm orange gradient used across all primary buttons.

### Global Modal Animations
Every modal overlay in the application now has smooth scale-in animations. Previously only a few modals were animated — the CSS rules now auto-apply to all modal backdrops across Work Orders, Invoices, Tasks, Expenses, Contracts, Materials, and Settings.

### Responsive Layout
Verified at desktop (1280px), tablet (768px), and mobile (375px). The "ROOF COMMAND" mobile branding, stacked card layouts, and full-width storm feed all work well. Over 80 screenshots were taken across three audit sessions.

## Security Hardening

Three rounds of security audits covered all 34 route files (~150 endpoints):
- **Fixed WKT injection vulnerability** in territory coordinates — coordinates are now validated as finite numbers before PostGIS string interpolation.
- **Added authentication** to the property import-progress endpoint (was previously accessible without login).
- **Removed debug endpoint** that leaked database schema information.
- **Added tenant ownership checks** on work order milestone updates.
- **Added admin role gating** on tenant settings modifications.
- **Added authentication** to the counties route.
- **Added admin checks** on user role changes.
- **Added tenant_id indexes** on 4 tables that were missing them.
- Comprehensive audit documentation written for each session.

## Product Recommendations

### Top 5 High-Impact Features to Build Next

1. **Historical Storm Data Archive** — Download and index the free SPC SVRGIS dataset (70+ years of severe weather reports). This is our biggest data gap versus HailTrace and is completely free. Could power a "Honey Hole Finder" that identifies neighborhoods with frequent historical hail damage.

2. **SMS/Texting Integration** — Every competitor has this. Twilio costs ~$0.0075 per message (~$20–50/month for typical usage). Even basic appointment reminders and estimate follow-ups would be high-value. Pass cost through to users.

3. **Lead Scoring Algorithm** — Combine historical storm frequency, home age, ownership rate, home value, storm proximity, FEMA declarations, and tree canopy data into an automated score. All data sources are free. No competitor offers this.

4. **QuickBooks Sync** — The most-requested missing feature versus JobNimbus and RoofLink. The QuickBooks API has a free tier for small apps. Basic invoice sync would cover the primary use case.

5. **AI Content Generation** — Rooftops.ai charges $12/month for their "Creator Studio" that generates ads, emails, and social posts. We could offer similar functionality using cheap LLM APIs (~$0.01 per request) and include it in the Professional tier.

### Free Data Sources to Integrate Next

| Source | What It Provides | Competitive Impact |
|---|---|---|
| SPC SVRGIS Archive | 70+ years of storm history | Closes biggest gap vs HailTrace |
| FEMA Disaster Declarations API | Federally declared disaster areas by county | Higher-value leads in declared areas |
| Census ACS Demographics | Home age, ownership rate, income by block group | Powers lead scoring algorithm |
| US Census Geocoder | Free address-to-coordinates (batch up to 10,000) | Eliminates Google geocoding costs |
| Microsoft Building Footprints | 130M building outlines with roof area | Free alternative to EagleView |
| NOAA Storm Events Database | Detailed storm records with dollar damage estimates | Prioritize which storms to target |

## Still Needs Attention

- **Historical storm data expansion** — Currently limited to a 30-day rolling window. The free SPC SVRGIS archive has 70+ years of data but requires a bulk import pipeline.
- **QuickBooks integration** — Needs OAuth flow setup and QB API key configuration. Critical for customer adoption.
- **SMS texting** — Requires Twilio account setup and cost pass-through billing model.
- **Remaining empty states** — Estimates, Contracts, Expenses, Work Orders, Automations, Drip Sequences, and Custom Fields pages still have minimal empty states.
- **React Query migration** — All data fetching uses raw useEffect. Migrating to React Query would improve caching, loading states, and error handling.
- **@dnd-kit for Pipeline** — Currently uses HTML5 drag API, which has mobile compatibility issues. @dnd-kit provides better touch support.
- **Hail swath color graduation** — Storm swaths display in a single color. Graduating color by hail size would help roofers prioritize areas with the most damage potential.
