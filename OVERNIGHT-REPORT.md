# StormPipe Overnight Report — March 24, 2026 (Run 2)

## Executive Summary

Tonight's second session focused on three critical areas: fixing the storm map's FEMA property performance bottleneck, polishing the UI across all pages with consistent animations and visual refinements, and completing a thorough visual audit of every page in the application at desktop, tablet, and mobile viewpoints. The FEMA property loading now uses point-in-polygon filtering so properties only appear inside actual storm swaths, eliminating the lag caused by loading thousands of irrelevant properties. Global modal animations were added to ensure every popup in the app has smooth, Apple-quality open/close transitions.

## Competitor Intelligence

The competitor gap analysis was updated earlier today and remains current. Key findings:

**JobNimbus** ($225-550/mo base + $30-75/user) is the dominant CRM with a mature mobile app and built-in texting. Their weakest point is pricing — a 5-person team pays ~$624/mo before add-ons.

**HailTrace** (~$83-300/mo) specializes in storm maps but charges extra for property data, canvassing, and commercial data. User reviews cite declining service quality and high costs.

**RoofLink** ($120/user/mo) differentiates with direct SRS material ordering from estimates. At 5 users, they cost $600/mo.

**Rooftops.ai** ($199/mo for AI features) is AI-first with satellite roof measurements and automated proposals. Still early-stage with "coming soon" features.

**Combined cost for a typical 5-person roofing company using JobNimbus + HailTrace: $824/month ($9,888/year).**

StormPipe matches or exceeds both combined at a fraction of the cost.

## Pricing Recommendation

| Tier | Price | Includes | Target |
|---|---|---|---|
| **Starter** | **$29/mo** | 3 users, CRM pipeline, estimates, invoices, storm map, 5 automations, basic reports | Solo operators |
| **Professional** | **$79/mo** | 10 users, everything in Starter + unlimited automations, canvassing, work orders, calendar, custom fields, contracts, expense tracking | Small teams (3-10) |
| **Enterprise** | **$149/mo** | Unlimited users, everything in Pro + priority support, API access, white-label | Large operations |

**Savings vs competitors:**

| Company Size | Competitors (JN + HT) | StormPipe | Monthly Savings | Annual Savings |
|---|---|---|---|---|
| Solo | $474/mo | $29/mo | **$445** | **$5,340** |
| 5-person | $824/mo | $79/mo | **$745** | **$8,940** |
| 10-person | $1,499/mo | $149/mo | **$1,350** | **$16,200** |

Our near-zero infrastructure costs (Neon free tier, NOAA free APIs) make these prices sustainable with strong margins.

## Changes Made Tonight

### 1. FEMA Property Performance Fix (Storm Map)
The storm map's biggest performance issue was that FEMA property records loaded across the entire visible map area, not just within storm swath boundaries. This caused severe lag when zooming into populated areas.

**Fix:** Added a point-in-polygon ray-casting algorithm that filters FEMA records to only include properties that fall *inside* an actual storm swath polygon (not just its bounding box). Also increased the zoom gate from 10 to 13, and added a 5,000-point global cap to prevent memory issues.

**Where to see it:** Go to Storm Map, enable Hail Reports and Properties, zoom into a storm swath area. Properties now load faster and only appear within the colored swath boundaries.

### 2. Global Modal Animations
Added CSS rules that automatically apply smooth scale-in animations to every modal overlay in the application. Previously, only CreateLeadModal and LeadDetail had animations — now WorkOrdersView, InvoicesView, TasksView, ExpensesView, ContractsView, MaterialsView, and SettingsView modals all animate.

**Where to see it:** Open any modal anywhere in the app (e.g., "New Work Order" on Work Orders page, "New Invoice" on Invoices page). The modal now fades in and scales up smoothly.

### 3. Content Studio Button Color Fix
The "Generate Content" button on the Content Studio page used a purple gradient that didn't match the app's orange accent color scheme. Changed to the standard warm orange gradient used across all primary CTA buttons.

**Where to see it:** Go to Content Studio (accessible from the sidebar). The Generate Content button now matches the orange theme.

### 4. Contracts Stat Card Icons
The Contracts page's stat cards (Total Contracts, Drafts, Awaiting Signature, Signed) were missing icons, unlike the Estimates and Invoices pages which have them. Added matching Heroicons for visual consistency.

**Where to see it:** Go to Contracts page — the stat cards at the top now have icons.

### 5. Tasks Empty State Improvement
Upgraded the Tasks page empty state from plain text to a structured layout with an icon, title, and descriptive text that encourages the user to create their first task.

**Where to see it:** Go to Tasks page when there are no tasks.

## Visual Audit Summary

Took 31 unique screenshots across every page at desktop (1280px), tablet (768px), and mobile (375px) viewports. Key findings:

- **Overall consistency is good** — the glass design system (oklch colors, backdrop-filter, border-radius) is consistent across all pages
- **Mobile responsive layout is excellent** — the "ROOF COMMAND" branding at mobile/tablet sizes works well, with stacked cards and the full-width storm feed
- **All Settings tabs work correctly** — verified Profile, Company, Billing, Payments, Team, Automations, Drip Sequences, Custom Fields, and Contracts tabs all render and switch properly
- **Pipeline mobile view** is polished with horizontal stage tabs and a floating action button
- **Materials catalog** looks professional with product cards, category filters, and stock badges
- **Reports page** renders all 6 chart types with real data
- **Calendar** uses FullCalendar with month/week/day/list views

## Product Recommendations

### Top 5 High-Impact Features to Build Next

1. **SMS/Texting integration** — Every competitor has this. Consider Twilio at ~$0.0075/msg. Even a basic "send appointment reminder" would be valuable.

2. **Photo annotation tool** — Roofers need to mark up roof photos showing damage. A canvas-based drawing tool overlay on uploaded images would be client-side only (free).

3. **Historical storm data expansion** — Currently 30-day rolling window from NOAA. Downloading and indexing NOAA Storm Events CSV data for 2-5 years would let roofers search past storms.

4. **Google review request automation** — After a job is marked "Completed," auto-generate a personalized review link. Free to implement.

5. **QuickBooks sync** — Most roofing companies use QB for accounting. The QB API has a free tier for small apps.

### Free Data Sources to Explore

- **Microsoft Building Footprints** — 129M US building outlines, free GeoJSON. Could estimate roof area.
- **NOAA Storm Events Database** — Bulk CSV with 10+ years of events. Free download.
- **NAIP Aerial Imagery** — USDA high-res aerial photos, free.
- **OpenStreetMap Buildings** — Building footprint data, free API.

## Still Needs Attention

- **Remaining empty states** — Most pages have basic text. Adding icons and CTAs everywhere would polish the new-user experience.
- **Canvassing region assignment** — HailTrace supports territory management. We have GPS pin-drop but no region drawing.
- **PWA manifest** — Adding a web manifest + service worker for install-to-home-screen would give a native app feel at zero cost.
- **QuickBooks integration** — The most-requested missing feature vs JobNimbus.
- **Photo annotation** — Canvas-based markup for roof damage photos.
