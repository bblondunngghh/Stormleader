# Overnight Report — 2026-04-06

## Executive Summary

Tonight's run delivered 5 competitor-informed feature improvements across the Dashboard, Storm Catalog, Estimates, and Content Studio. Competitors studied included JobNimbus (pipeline analytics), HailTrace (storm search), RoofLink (insurance workflows and stale lead detection), SumoQuote (estimate upselling), and Rooftops.ai (content generation UX). A separate UI consistency check confirmed all changes pass the project's glass/oklch design standards with no fixes needed.

## Competitor Comparisons & Improvements Made

### 1. Days-in-Stage Dashboard Cards (vs JobNimbus Insights)
- **Competitor finding:** JobNimbus Insights has a dedicated "Workflow Dashboard" showing average days per pipeline stage with clickable drill-down into stuck jobs. StormLeads only had stage duration as a chart in the Reports page — not on the main dashboard.
- **Before:** Dashboard showed stat cards, funnel, activity feed, and leaderboard but no pipeline velocity metrics at a glance.
- **What changed:** Added a new dashboard section with cards for each pipeline stage showing average days leads spend there, with stuck-lead indicators. Clicking a card drills into the filtered lead list for that stage.
- **Where to see it:** Dashboard page, below the existing stat cards section.

### 2. Calendar-Based Storm Search (vs HailTrace)
- **Competitor finding:** HailTrace offers a Year → Month → Day calendar drill-down to find historical storms. StormLeads only had time-range pills (24h, 3d, 7d, etc.) with no way to search a specific date range.
- **Before:** Storm Catalog had 5 preset time-range buttons. Users wanting storms from a specific week or month had no option.
- **What changed:** Added a "Custom" pill that reveals start and end date pickers (using the project's DatePicker component). Backend storms API now accepts dateFrom/dateTo parameters for precise historical queries.
- **Where to see it:** Storm Catalog page, click the "Custom" pill in the time range filter bar.

### 3. Insurance Claim Fields + Optional Upgrades on Estimates (vs RoofLink + SumoQuote)
- **Competitor finding:** RoofLink has a full insurance workflow with ACV, depreciation, O&P, and deductible fields baked into every estimate. SumoQuote claims $2,078 average upsell revenue per signed quote via their dedicated upgrades/add-ons section.
- **Before:** Estimates had no insurance-specific fields. No way to offer optional upgrades that customers could select at signing time.
- **What changed:** Two new collapsible sections on the estimate builder. Insurance section includes company name, claim number, date of loss, RCV, ACV, depreciation, deductible, O&P percentage, and proceeds received — with a summary bar calculating balance due. Upgrades section lets the estimator add optional add-ons (name, description, price) that customers can select during signing, with a running total.
- **Where to see it:** Estimate builder — "Insurance Details" and "Optional Upgrades" collapsible panels below the main line items.

### 4. Stale Lead Alerts on Dashboard (vs RoofLink)
- **Competitor finding:** RoofLink triggers stale job alerts at 3-day and 7-day thresholds, surfacing neglected leads before they go cold. StormLeads had no stale lead visibility on the dashboard.
- **Before:** The stale lead notification cron existed (built 2026-04-04) but results were only visible in the notification bell. The dashboard had no dedicated stale lead section.
- **What changed:** New dashboard panel showing leads untouched for 3+ days with color-coded severity badges: red for 14+ days, amber for 7-14 days, blue for 3-7 days. Each row shows the lead name, assigned rep, and days since last activity. Clicking a row navigates to the lead detail page.
- **Where to see it:** Dashboard page, new "Stale Leads" panel.

### 5. Content Studio Visual Grid Layout (vs Rooftops.ai)
- **Competitor finding:** Rooftops.ai presents its AI content tools as a visual card grid with icons and descriptions — making all content types discoverable at a glance. StormLeads used a simple dropdown selector that hid available content types.
- **Before:** Content type selection was a single dropdown menu requiring users to click and scroll to discover options.
- **What changed:** Replaced the dropdown with a visual card grid. Each content type (social posts, door hangers, emails, blog posts, ad copy, cold call scripts, landing pages) gets its own glass-styled card with a Material Symbols icon, title, and brief description. Selected card shows a glow highlight.
- **Where to see it:** Content Studio page, the content type selector area.

## New Features Built

No net-new feature categories were introduced tonight. All 5 changes were enhancements to existing feature areas, informed by specific competitor gaps identified in the competitor UI research document.

## Features Still Behind Competitors

### High Priority
1. **Multi-page estimate proposals** — SumoQuote offers 7+ page types (cover, introduction, inspection photos, estimate details, signing, terms, warranty). StormLeads has a single-page estimate builder. This is the #1 remaining quality gap in the estimates area.
2. **In-app SMS texting** — JobNimbus and RoofLink have full SMS threading. StormLeads has the SMS UI built but no Twilio adapter connected. Needs a Twilio account and billing model.
3. **QuickBooks sync** — JobNimbus has deep two-way QuickBooks integration. StormLeads has no accounting sync at all. Needs OAuth flow setup.

### Medium Priority
4. **Customizable canvassing pins with visit counters** — HailTrace allows custom status colors/icons per pin and tracks visit attempt numbers. StormLeads has basic pin dropping with status selection but no visit counting or fully custom icons.
5. **Canvassing leaderboard** — HailTrace shows per-rep stats (markers dropped, contacts made, prospects, leads, sales). StormLeads has a team leaderboard on the dashboard but nothing canvassing-specific.
6. **Profit Tracker dashboard** — JobNimbus Insights has Planned vs Actual gross/net profit, variance by salesperson, and commission tracking. StormLeads has per-lead profit only.
7. **Crew-limited login role** — RoofLink offers a $30/month crew login with restricted visibility (photos, notes, calendar, work orders only — no profit data). StormLeads has no role-restricted views.

### Lower Priority
8. **Year-over-year comparison on reports** — JobNimbus overlays this year vs last year on trend charts.
9. **Social media post scheduling** — Rooftops.ai can schedule and track social posts. StormLeads generates content only.
10. **AI roof reports from satellite imagery** — Rooftops.ai's core differentiator. Would require a significant image analysis integration.

## Where I Stopped

Tonight's run covered all 5 feature commits from Session 3 (the implementation session) and a clean UI consistency check in Session 4. All planned work was completed successfully.

**Next run should start at:**
1. Multi-page estimate structure (cover + scope + details + terms + signing) — the #1 remaining quality gap
2. In-app SMS via Twilio adapter — the #1 remaining communication gap
3. Customizable canvassing pins + visit counter — medium effort, high field value
4. Canvassing leaderboard — medium effort, competitive differentiator

**Known technical debt for future runs:**
- Invoice automated reminders (migration 044 exists, no cron or UI wired up)
- "LAUNCH MEASUREMENT TOOL" button in Storm Map does nothing
- LoginPage still has hardcoded test credentials
- "Mock (Testing)" financing provider should be hidden in production
- ~25 silent empty catch blocks across the codebase
