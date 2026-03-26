# StormLeads Overnight Report — March 26, 2026

## Executive Summary

Tonight's session focused on three areas: validating competitor pricing with fresh data (discovering RoofLink's price jump to $400/user/month), building a CSV lead import feature with free geocoding, and completing the oklch color system migration across the entire application. A critical map performance bug was also fixed where FEMA property dots were appearing everywhere on the map due to stale IndexedDB cache restoration.

## Competitor Intelligence

### Key Findings

**RoofLink price increase confirmed:** Fresh scrapes of RoofLink's own pricing page reveal they now charge **$400/user/month** — up from ~$120 before the SalesRabbit/Roofle acquisition in January 2026. Third-party review sites (Capterra, GetApp) still show outdated pricing. A 5-person roofing team using RoofLink now pays **$2,000/month** ($24,000/year). This is the most expensive option in the market.

**JobNimbus remains opaque:** They've removed all dollar amounts from their website ("Request pricing" only). Third-party analysis estimates a solo operator pays $349/month, a 10-person team pays $1,254/month — before add-ons. Their new AssistAI phone answering feature costs an additional $298/agent/month.

**QuoteIQ is the emerging threat:** This AI-first newcomer starts at $29.99/month with AI tools included on every plan. However, they have zero storm data or weather mapping — which remains our strongest competitive moat.

**HailTrace growing:** Now reports 10,000+ clients (up from 9,000+). Estimated pricing range is $999-$1,999/year depending on tier.

### What They Charge vs What We Could Charge

| Scenario | JobNimbus + HailTrace | RoofLink | StormLeads |
|---|---|---|---|
| Solo operator | $432/month | $400/month | **$29/month** |
| 5-person team | $769/month | $2,000/month | **$79/month** |
| 10-person team | $1,454/month | $4,000/month | **$149/month** |

## Pricing Recommendation

| Tier | Price | Users | Target Customer |
|---|---|---|---|
| **Starter** | $29/month | Up to 3 | Solo roofers and small crews |
| **Professional** | $79/month | Up to 10 | Growing companies with sales + field teams |
| **Enterprise** | $149/month | Unlimited | Large operations needing API access and white-label |

**Savings pitch:** A 5-person team switching from JobNimbus + HailTrace saves **$8,280/year** (90% reduction). Switching from RoofLink saves **$23,052/year** (96% reduction). Every feature competitors charge extra for — estimates, e-signatures, payments, automations, storm data — is included at every StormLeads tier.

## New Features Added

### CSV Lead Import with Free Geocoding
A new Import button appears in the Leads toolbar. Users can drag-and-drop a CSV file, map columns to StormLeads fields (name, address, phone, email, stage, source), preview the data, and import. Addresses are geocoded using the free US Census API — no Google API costs. Supports up to 10,000 addresses per import. Shows real-time results: how many leads were created, skipped (duplicates), or failed. This eliminates the need for manual lead entry and replaces a feature that competitors like HailTrace charge for in their data-tier plans.

## UI Improvements

### Complete oklch Color Migration
Every remaining hardcoded hex color and rgba() shadow across the entire application has been converted to oklch values. This affects the Storm Map, Lead Detail, date/time pickers, custom dropdowns, alert settings, photo annotator, top navigation bar, and main stylesheet. The application now uses a single, consistent color system with no legacy color formats remaining.

### FEMA Map Property Loading Fix
Fixed a critical bug where FEMA property dots were appearing across the entire map on initial load, causing severe lag. Root cause: FEMA properties were being persisted to IndexedDB and restored before storm swath data loaded, so the dots had no polygon to filter against. The fix stops caching FEMA data in IndexedDB (it's transient, on-demand data), filters out stale entries during cache restore, and purges FEMA points from memory when zooming below level 14.

## Product Recommendations

### Top 5 High-Impact Features to Build Next

1. **Honey Hole Finder** — Query the NOAA SWDI API on-demand to show historical hail frequency by area. This is HailTrace's signature feature, and the same underlying data (radar-detected hail signatures) is freely available via REST API with no storage requirements. Display as a heat overlay: "This neighborhood had radar-confirmed hail 7 times in the past 10 years."

2. **Automated Lead Scoring** — Combine Census ACS demographics (home age, ownership rate, income), FEMA disaster declarations, and SWDI hail history into a composite score. All data queried at runtime from free APIs. No competitor offers transparent, algorithm-based lead scoring — this would be a genuine differentiator.

3. **SMS/Texting via Twilio** — Contractors expect to text customers. Twilio costs approximately $0.0075 per message. Pass the cost through to users or absorb it on paid tiers. JobNimbus charges $49-249/month for their texting add-on.

4. **QuickBooks Sync** — Both JobNimbus and RoofLink integrate with QuickBooks. The QuickBooks API has a free tier for small applications. Start with one-way invoice push, then add two-way sync.

5. **AI Content Generation** — Rooftops.ai offers AI marketing content for $12/month. A basic integration with any LLM API (approximately $0.01 per request) would match this at near-zero cost. Generate door-knock scripts, follow-up emails, social posts, and estimate cover letters.

### Free On-Demand APIs to Integrate

All of these are runtime queries — no bulk data imports, no database storage beyond user-generated content.

| API | What It Provides | Cost | Priority |
|---|---|---|---|
| NOAA SWDI | 10+ years of radar hail history by location | Free, no key | High |
| Census ACS | Home age, ownership rate, income by block group | Free, instant key | High |
| FEMA Housing Assistance | Damage application counts by ZIP code | Free, no key | Medium |
| Overture Maps | 2.3B building footprints with roof data | Free tier, key required | Medium |
| OSRM | Canvassing route optimization | Free, public server | Medium |
| Open Topo Data | Elevation per coordinate for flood/drainage risk | Free, 1 req/sec | Low |

## Still Needs Attention

**Territory/Region Assignment:** The canvassing territory feature was built in a previous session with PostGIS polygon support, but the feature comparison matrix still shows it as "Missing." Needs verification that it's fully functional and the matrix updated.

**Historical Storm Data Depth:** HailTrace advertises 10+ years of storm history; StormLeads currently has a 30-day rolling window from NOAA. The SWDI API integration (Honey Hole Finder) would close this gap without any database storage, but it hasn't been built yet.

**React Query Migration:** All data fetching still uses raw useEffect hooks. This works but means no automatic cache invalidation, no optimistic updates, and no background refetching. Not blocking, but would improve perceived performance.

**Dashboard Loading Skeleton:** The dashboard loads each section independently with scattered loading states. A unified shimmer skeleton would make the initial load feel more polished.

**Remaining N+1 Queries:** Three backend functions still have N+1 patterns: storm lead generation, lead scoring, and drip sequence step processing. These will become bottlenecks as usage grows.
