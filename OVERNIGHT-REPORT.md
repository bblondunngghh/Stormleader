# Overnight Report — 2026-04-08

## Executive Summary

Tonight's run delivered four competitor-informed feature improvements: storm severity star ratings on the dashboard and map (vs HailTrace), a lead source revenue chart on the dashboard (vs JobNimbus Insights), token/merge field insertion for the estimate editor (vs SumoQuote), and deposit/progress payment fields on estimate authorization (vs SumoQuote). Competitor research and app inventory docs were refreshed. A UI consistency check confirmed all new code follows glass/oklch standards with zero fixes needed.

## Competitor Comparisons & Improvements Made

### 1. Storm Severity Star Rating (vs HailTrace)

**What we studied:** HailTrace rates every storm swath on a 1-to-5 star scale based on property count impacted, max hail size, and probability of finding damage. Their free tier only shows 1-star storms — the star system doubles as a paywall gate and a prioritization tool.

**Before:** Storm swaths appeared on the dashboard and map popups with raw size/speed data but no visual severity indicator. Users had to mentally interpret hail diameter numbers to decide which storms were worth canvassing.

**What changed:** Added a 1-5 star rating algorithm that factors in max hail size, wind speed, and report count. Stars display as gold-filled icons on both the Dashboard storm activity panel and individual map popup cards. Users can instantly scan which storms deserve attention without interpreting raw weather data.

**Where to see it:** Dashboard storm activity section and any storm swath popup on the Storm Map.

### 2. Lead Source Revenue Chart (vs JobNimbus Insights)

**What we studied:** JobNimbus provides revenue attribution dashboards that show which lead sources (door knock, referral, storm map, etc.) generate the most closed revenue. This helps contractors decide where to invest canvassing time and marketing dollars.

**Before:** The dashboard showed pipeline stage counts and activity feeds but had no revenue attribution by source. Users couldn't answer "which lead source is most profitable?"

**What changed:** Added a horizontal bar chart showing total revenue by lead source, pulled from closed-won leads. New backend endpoint aggregates revenue grouped by source with a single SQL query. The chart uses the existing glass Panel component and oklch color palette.

**Where to see it:** Dashboard, below the existing stat cards.

### 3. Token/Merge Field Insertion for Estimates (vs SumoQuote)

**What we studied:** SumoQuote's estimate builder supports merge tokens — placeholders like {{customer_name}}, {{property_address}}, {{total}} — that auto-populate when generating the customer-facing estimate. This eliminates manual copy-paste of customer details into every estimate.

**Before:** The estimate rich text editor required manually typing all customer and project details. No way to insert dynamic fields that resolve at render time.

**What changed:** Added a merge field insertion menu to the estimate editor toolbar. Users can insert tokens for customer name, address, phone, email, estimate total, date, and company name. Backend service resolves tokens when generating the customer-facing estimate. Eight token types available at launch.

**Where to see it:** Estimate builder editor toolbar — new "Insert Field" button.

### 4. Deposit & Progress Payment Fields (vs SumoQuote)

**What we studied:** SumoQuote includes a dedicated authorization section on estimates where contractors can define deposit requirements, progress payment milestones, and payment terms. This is standard in construction estimating — customers expect to see payment structure before signing.

**Before:** Estimates showed a total amount and signature block but had no structured deposit or progress payment section. Contractors would have to manually type payment terms into the estimate body text.

**What changed:** Added a toggleable deposit/progress payment section to the estimate authorization area. Includes deposit amount (fixed or percentage), progress payment milestone field, and balance-due calculation. The toggle uses consistent glass styling and form-input classes.

**Where to see it:** Estimate builder, authorization section — toggle "Include Deposit Requirements."

## New Features Built

No net-new standalone features were built tonight. All four improvements enhanced existing components (Dashboard and EstimatesView).

## Features Still Behind Competitors

1. **QuickBooks/Xero Sync** — JobNimbus and RoofLink both offer QuickBooks integration for invoice syncing. We have no accounting integration. This is the single largest operational gap for contractors who manage billing.

2. **SMS/Texting** — RoofLink and Roofr offer in-app SMS messaging. We have drip email sequences but no text messaging capability. SMS has significantly higher open rates for appointment confirmations and follow-ups.

3. **Multi-Page Estimate Proposals** — SumoQuote generates multi-page branded proposals with cover pages, scope of work sections, and terms pages. Our estimates are single-section documents. This is the biggest remaining quality gap in the estimating workflow.

4. **Weather History PDF per Address** — HailTrace generates a 14+ year weather history PDF for any address, used as evidence for insurance claims. We show storm history on-screen but don't export it as a shareable document.

5. **Draw-to-Select Polygon Tool** — HailTrace allows drawing custom polygons on the map to select properties within an area. We only support swath-based or canvassing list selection.

6. **Automated Invoice Reminders** — Database migration exists (044) but cron job and email templates haven't been built yet.

## Where I Stopped

The UI consistency check (Stage 4) was completed — all four modified components passed glass/oklch/form-element standards with no fixes needed. The five-stage overnight pipeline (research → inventory → implementation → UI check → report) is fully complete for this run.

Next run should start with: QuickBooks sync adapter (largest competitive gap), then SMS/Twilio integration, then automated invoice reminder cron job.
