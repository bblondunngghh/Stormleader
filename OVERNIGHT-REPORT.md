# Overnight Report — 2026-04-07

## Executive Summary

Tonight's run focused on three feature areas identified from competitor research: canvassing pin visualization (vs HailTrace/RoofLink), estimate insurance workflow (vs RoofLink/SumoQuote), and dashboard response-time analytics (vs RoofLink/Roofr). Four feature commits were landed plus a UI consistency fix, totaling ~280 lines of production code across 4 components and 1 backend service. Work order PDF export was started but not committed.

## Competitor Comparisons & Improvements Made

### 1. Canvassing Pin Visualization (vs HailTrace / RoofLink)

**Competitor benchmark:** HailTrace uses a 3-color pin system (green/yellow/red) with visual distinction between pin outcomes. RoofLink includes a toggle-able legend panel showing pin categories.

**Before:** StormLeads canvassing pins were plain same-colored circles with no visual differentiation between outcomes (not home, not interested, interested, scheduled, converted).

**After:** Pins are now color-coded teardrop shapes — red for not interested, amber for not home, green for interested, blue for scheduled, gold-stroked for converted leads. A floating legend panel (toggled via eye icon) shows per-outcome counts and overall conversion rate. High-priority pins (interested/scheduled) render on top via z-index ordering. A conversion rate metric was added to the analytics stats bar.

**Where to see it:** Canvassing mode (accessible from Storm Map sidebar).

### 2. Estimate Insurance Auto-Calculations (vs RoofLink / SumoQuote)

**Competitor benchmark:** RoofLink's estimate builder auto-calculates depreciation, insurance pays, and customer owes fields. SumoQuote reports an average $2,078 upsell per estimate from their insurance workflow.

**Before:** The insurance section (added in the prior run) had input fields for RCV, ACV, depreciation, deductible, and O&P, but depreciation was manual-entry only and there was no computed "Insurance Pays" or "Customer Owes" summary.

**After:** Depreciation now auto-calculates as RCV minus ACV when both values are entered. Two new computed fields — "Ins. Pays" (RCV minus deductible plus O&P) and "Customer Owes" (deductible minus insurance proceeds, if applicable) — provide a complete insurance breakdown. The measurement tool button (previously dead UI) now launches a guidance toast explaining integration options.

**Where to see it:** Estimates page, open any estimate with the Insurance toggle enabled.

### 3. Speed-to-Lead Dashboard Metric (vs RoofLink / Roofr)

**Competitor benchmark:** RoofLink tracks first-response time prominently. Roofr markets "instant response" as a key differentiator for contractor leads, citing industry data that 78% of customers go with the first responder.

**Before:** Dashboard had 4 KPI stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with no response-time tracking.

**After:** A 5th stat card — "Speed to Lead" — shows average minutes from lead creation to first logged activity over a rolling 30-day window. Color-coded performance badge: green "Excellent" at 5 minutes or under, amber "Good" at 30 minutes or under, red "Slow" above 30 minutes. Backend uses a LATERAL join query for efficient calculation.

**Where to see it:** Dashboard, top stat cards row (5th card on the right).

### 4. UI Consistency Fix

The canvassing mode legend panel had one SVG stroke using rgba color syntax instead of oklch. Fixed for design system consistency.

## New Features Built

No net-new features were built this run — all work was enhancement of existing features to close competitor gaps.

## Work In Progress (Uncommitted)

Work order PDF export was started — backend pdfmake endpoint, frontend download button with glass styling, and milestone completion timestamps with time display. This code is in the working tree but was not committed as it was still being tested.

## Features Still Behind Competitors

### High Priority
- **Multi-page estimate proposals** — SumoQuote and RoofLink offer cover pages, multiple sections, and terms pages. Our estimates are single-page only. This is the #1 quality gap in the estimating workflow.
- **QuickBooks sync** — JobNimbus, RoofLink, and SumoQuote all offer QuickBooks integration. Requires OAuth flow setup.
- **In-app SMS texting** — RoofLink and JobNimbus include SMS for appointment reminders and lead follow-up. Our UI framework exists but needs a provider (Twilio or similar).

### Medium Priority
- **Property sidebar on storm map** — HailTrace shows a persistent left sidebar with owner details, home value, Street View, and weather history when a property is selected. We show a popup only.
- **Draw-polygon lead generation on map** — HailTrace lets users draw a custom polygon to generate a lead list from all properties inside it.
- **Profit Tracker dashboard** — JobNimbus Insights shows per-job and per-rep profitability. We track per-job profit in Lead Detail but lack the aggregate dashboard.
- **Canvassing leaderboard** — HailTrace shows team canvassing stats. We have team leaderboard for overall sales but not canvassing-specific.

### Lower Priority
- **AI chat assistant** — Rooftops.ai and QuoteIQ offer AI-powered features. Our Content Studio generates templates but has no conversational AI.
- **React Query migration** — All data fetching uses raw useEffect. Not user-facing but affects code quality and loading states.

## Where I Stopped

The work order PDF export feature was in progress — backend endpoint is written, frontend download button is wired, but the code was not committed. The next run should either finish testing and commit this, or start on multi-page estimate proposals, which is the #1 remaining quality gap identified in competitor research.
