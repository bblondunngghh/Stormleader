# StormPipe Overnight Report — March 24, 2026

## Executive Summary

Tonight's session focused on three priorities: updating competitor intelligence with two new competitors (RoofLink and Rooftops.ai), fixing critical backend bugs that were causing dashboard errors, and adding a global animation system for Apple-quality motion throughout the app. Five commits were made, multiple bugs were fixed, and the complete competitor landscape now covers all four major competitors.

## Competitor Intelligence

### New Competitors Researched

**RoofLink** ($120/user/month, flat rate):
- 7-step workflow from lead to payment — key differentiator is material ordering directly from SRS Distribution
- Integrations with SalesRabbit, QuickBooks, Stripe, Hover, EagleView, CompanyCam, Zapier
- Territory mapping for canvassing with rep assignment and overlap prevention

**Rooftops.ai** ($199/mo for AI employees, $5k consulting setup):
- AI-first approach: satellite-powered roof measurements with pitch, facet counts, and square footage
- One-click proposal generation sent directly to homeowners
- Automated follow-up drip sequences (we already have this, for free)
- Solar upselling analysis built in (we already have Google Solar API integration)

### Pricing Comparison

| Company Size | JobNimbus + HailTrace | RoofLink | Rooftops.ai | **StormPipe** |
|---|---|---|---|---|
| Solo operator | $474/mo | $120/mo | ~$199/mo | **$29/mo** |
| 5-person team | $824/mo | $600/mo | ~$199/mo+ | **$79/mo** |
| 10-person team | $1,499/mo | $1,200/mo | ~$199/mo+ | **$149/mo** |

StormPipe saves roofing companies **85-94%** compared to JobNimbus + HailTrace.

## Pricing Recommendation

| Tier | Price | Key Features |
|---|---|---|
| **Starter** | $29/mo | 3 users, CRM pipeline, estimates, invoices, storm map, basic reports |
| **Professional** | $79/mo | 10 users, everything + automations, canvassing, work orders, calendar, custom fields |
| **Enterprise** | $149/mo | Unlimited users, everything + priority support, API access |

## Bug Fixes

- **Dashboard Tasks Today 500 Error**: SQL query referenced 'urgent'/'high' priorities that don't exist in the enum. Fixed to use hot/warm/cold.
- **SPC Storm Ingestion Crash**: Early return in ingestHail/ingestWind returned integer instead of object. Fixed.
- **Missing Drip Tables**: Applied migration to create drip_sequences, drip_sequence_steps, drip_enrollments tables.
- **Missing Page Titles**: Contracts, Expenses, Content Studio now show correct titles in the TopBar.

## New Features

### Global CSS Animation System
Apple-quality motion system with spring deceleration curves:
- Page fade-in transitions, button hover/press effects, card lift on hover
- Input focus glow, modal scale animations, skeleton shimmer loading
- CSS custom properties (--transition-fast/normal/slow/spring) for consistency

### FEMA Property Loading Optimization
Batched FEMA property loading — single Supercluster rebuild instead of per-chunk rebuilds.

## Visual Audit (26+ screenshots)

All pages audited at desktop, tablet, and mobile viewports. Mobile experience has dedicated "ROOF COMMAND" layout with card-based UI and bottom navigation.

## Product Recommendations

1. **Microsoft Building Footprints** (FREE) — 129M+ US building outlines for roof area estimation
2. **NOAA Historical Storm Data** — Expand from 30-day to multi-year storm history
3. **Photo Annotation Tool** — Client-side canvas markup for roof damage photos
4. **QuickBooks Integration** — Free-tier API for invoice/expense syncing
5. **Basic SMS Follow-up** — Twilio pay-as-you-go at $0.008/message

## Still Needs Attention

- Security review in progress (analyzing all API routes for auth/tenant isolation)
- Lead Detail panel scrolling behavior
- Historical storm data expansion (major competitive gap vs HailTrace)
- Settings tab switching rendering
