# StormLeads Overnight Report — March 25, 2026

## Executive Summary

Tonight's session focused on three strategic priorities: competitive intelligence refresh, security hardening, and UI polish. We validated pricing data for all five competitors via live web scrapes, discovered a new AI-first competitor (QuoteIQ), implemented rate limiting and token hashing on auth endpoints, researched 17 free on-demand data APIs, and completed a full hex-to-oklch color migration across the entire application. The platform is now more secure, visually consistent, and strategically positioned against competitors charging 10–50x more.

## Competitor Intelligence

### Market Landscape (Verified March 25, 2026)

**JobNimbus** remains the dominant player with 6,000+ contractors, but their pricing has become opaque and expensive. A solo operator pays $349/month minimum, and a 10-person team pays $1,254/month before add-ons. Their new AI features (AssistAI phone receptionist at $298/agent/month, Scout mobile assistant in beta) are impressive but premium-priced. User reviews cite "horrendous" customer support, "finicky" integrations, and a confusing three-layer cost model.

**HailTrace** is the storm mapping leader (10,000+ contractors) with 15 in-house meteorologists. Annual pricing ranges $999–$1,999/year. Their "Honey Hole Finder" for high-damage-zone identification is their killer feature. However, their core hail data comes from the same NOAA MRMS dataset we already ingest for free.

**RoofLink** (powered by SalesRabbit) charges $120/user/month with no tiers — simple but expensive for teams. Their January 2026 acquisition of Roofle added instant online pricing and AI-assisted financing, creating the first end-to-end contractor platform from online quoting through production.

**Rooftops.ai** is remarkably cheap at $12/month for 300 AI roof reports, solar analysis, and content generation. However, they have zero CRM, zero storm mapping, and zero team features — they're a tool, not a platform.

**QuoteIQ** (new discovery) is an emerging AI-first CRM at $29.99–$399.99/month. Their standout feature is an AI Virtual Call Team that can cold-call 300 homeowners in storm zones. However, they have absolutely no storm data or weather mapping — our strongest competitive moat.

### Key Competitive Insight

Every competitor either charges a premium for storm data (HailTrace: $83–200+/month) or doesn't offer it at all (JobNimbus, RoofLink, Rooftops.ai, QuoteIQ). StormLeads is the only platform that combines a full CRM with free storm mapping powered by the same government data sources the industry leaders use.

## Pricing Recommendation

### Suggested Tiers

| Tier | Price | Target | Key Differentiator |
|---|---|---|---|
| **Free** | $0 | Solo operators exploring | Storm map, 5 leads, basic pipeline |
| **Starter** | $29/month | Solo roofers | Full CRM, unlimited leads, storm alerts, estimates, invoicing |
| **Pro** | $79/month | Growing teams (up to 10) | Team management, automations, canvassing, drip sequences, reports |
| **Business** | $149/month | Large operations (unlimited users) | Custom fields, API access, priority support, white-label estimates |

### Savings vs. Competitors

| Scenario | Competitor Cost | StormLeads Cost | Annual Savings |
|---|---|---|---|
| Solo operator (CRM + storm data) | $432/mo (JobNimbus + HailTrace) | $29/mo | **$4,836/year** |
| 5-person team | $769/mo (JobNimbus + HailTrace) | $79/mo | **$8,280/year** |
| 10-person team | $1,454/mo (JobNimbus + HailTrace) | $149/mo | **$15,660/year** |
| Solo + AI reports | $361/mo (JN + HailTrace + Rooftops.ai) | $29/mo | **$3,984/year** |

The pricing positions StormLeads as the affordable all-in-one alternative. A solo roofer saves over $400/month compared to the standard JobNimbus + HailTrace stack. Even against QuoteIQ's aggressive $29.99/month, StormLeads wins because we include storm mapping — something no competitor at this price point offers.

## New Features Added

### Rate Limiting on Authentication Endpoints
Authentication routes now enforce request rate limits to prevent brute-force password attacks. This is a standard security best practice that was identified as missing during the prior security audit.

### Hashed Refresh Tokens
Refresh tokens are now stored as cryptographic hashes instead of plaintext. If the database were ever compromised, attackers could not reuse stolen tokens to impersonate users. This closes the last high-priority item from the security audit.

### Polygon-Based Property Loading on Storm Map
The storm map now uses server-side polygon intersection to load FEMA properties, replacing the old bounding-box approximation. Elongated storm swaths (common with hail events) previously loaded thousands of irrelevant properties outside the actual damage path. The new approach loads only properties within the verified storm polygon, dramatically reducing noise and improving map responsiveness.

### Free On-Demand Data API Research
Catalogued 17 free government and open-source APIs that can enrich leads and power new features without storing any data in our database. The top discoveries include NOAA SWDI (10+ years of radar hail history per location), Overture Maps (2.3 billion building footprints), USGS aerial imagery tiles (free alternative to Nearmap/EagleView), and Census ACS demographics (home age and ownership data for lead scoring).

## UI Improvements

### Full Application Color Migration (hex → oklch)
Every remaining hardcoded hex and rgba color value across the application was replaced with oklch equivalents and CSS custom properties. This affected the Dashboard, Pipeline, Estimates, Tasks, Storm Map, Lead Detail, and Mobile Bottom Tab Bar. The app now uses a single, consistent color system that renders predictably across displays and supports the dark-mode-first design language.

### Modal Animation Consistency
All remaining modal overlays (Email, Estimates, Expenses, Invoices, Materials, Settings) received the standard modal-backdrop class for consistent scale-in animations. Previously, some modals used inline styles that bypassed the global animation system.

### Glass Styling Consistency
Form inputs and interactive elements across Storm Map and Lead Detail were updated to use the standard glass and form-input classes, eliminating one-off styling that broke visual consistency.

## Product Recommendations

### Top 5 High-Impact Features to Build Next

1. **"Honey Hole Finder" (Historical Hail Frequency Map)** — Use the NOAA SWDI REST API to query 10+ years of radar-detected hail events per location. Display a heat map layer showing which neighborhoods get hit repeatedly. This directly replicates HailTrace's most popular feature using free data queried on-demand. No database storage required.

2. **Automated Lead Scoring** — Combine on-demand data from Census ACS (home age, ownership rate), FEMA Disaster Declarations (federal disaster zones), and SWDI hail history into a composite lead score. A 40-year-old owner-occupied home in a repeatedly hail-hit, FEMA-declared zone scores higher than a new rental. No competitor offers algorithmic lead scoring at this price point.

3. **USGS Aerial Imagery Layer** — Add free high-resolution (60cm) NAIP satellite imagery tiles from the USGS National Map as an optional map layer. This is the same class of imagery that EagleView and Nearmap charge hundreds per month for. Integration is a single tile URL added to the map component.

4. **Census US Geocoder Integration** — Replace Google Geocoding API calls with the free Census Geocoder for CSV lead imports. Eliminates the single largest variable cost in the platform. The Census API handles single-address and batch geocoding (up to 10,000) with no API key and no per-request charge.

5. **QuickBooks Online Sync** — The most-requested integration across all roofing CRM reviews. Both JobNimbus and RoofLink offer it. A basic invoice push using QuickBooks' free API tier would close the most visible gap in the feature comparison matrix.

### Free On-Demand APIs to Integrate

| API | What It Provides | Integration Effort |
|---|---|---|
| NOAA SWDI REST | 10+ years radar hail history by location | 1–2 days |
| Census ACS | Home age, ownership rate, income by block group | 1–2 days |
| FEMA Housing Assistance | Damage application density by ZIP code | Half day |
| Overture Maps REST | Building footprints with height and roof shape | 1–2 days |
| USGS National Map Tiles | Free high-res aerial imagery (60cm NAIP) | Half day |
| US Census Geocoder | Free address-to-coordinates (replaces Google) | 1 day |
| OSRM Routing | Optimized canvassing routes through neighborhoods | 1 day |

All of these are queried at runtime — no data is stored in our database. This is critical: our production database is on Neon's free tier with a 0.5 GB storage limit. Every external data source must remain external.

## Still Needs Attention

### Not Yet Addressed
- **QuickBooks sync** — Requires OAuth flow setup and API key registration. Most impactful missing integration.
- **SMS/texting** — Twilio costs approximately $0.0075/message. Needs billing model design before implementation.
- **Historical storm data depth** — Currently limited to a 30-day window. The SWDI API can extend this to 10+ years but hasn't been integrated yet.
- **Native mobile app** — All competitors have native iOS/Android apps. The web app is responsive but lacks offline capability and push notifications.
- **AI content generation** — Rooftops.ai and QuoteIQ both offer AI-powered content tools. A basic LLM integration for marketing emails and social posts would close this gap cheaply.
- **Dashboard loading skeleton** — The dashboard still loads each section independently without unified shimmer placeholders.
- **Remaining N+1 queries** — Storm lead generation, lead scoring, and drip sequence processing still have sequential database query patterns that should be batched.
- **React Query migration** — All data fetching uses raw useEffect hooks. Migration to React Query would add caching, background refresh, and optimistic updates.
- **@dnd-kit for Pipeline** — The kanban board uses the HTML5 Drag API which has limited mobile support. @dnd-kit would improve touch device interaction.

### Priorities for Next Session
1. Integrate NOAA SWDI API for historical hail frequency (Honey Hole Finder)
2. Build automated lead scoring algorithm using on-demand API data
3. Add USGS aerial imagery tile layer to storm map
4. Replace Google Geocoding with Census Geocoder
5. Begin QuickBooks OAuth integration
