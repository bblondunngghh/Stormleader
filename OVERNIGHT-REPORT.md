# Overnight Report — 2026-04-04

## Executive Summary

Tonight's run built 3 competitive features after completing a fresh round of competitor UI research across HailTrace, JobNimbus, RoofLink, and Rooftops.ai. The headline addition is a pipeline card sidebar preview matching JobNimbus's best UX pattern, followed by stale lead alerts (matching RoofLink) and two new Content Studio content types (matching Rooftops.ai). A fourth feature — in-person estimate signing — was started but not committed. Total: 3 feature commits, 2 docs commits, 1,767 lines added across 8 files.

---

## Competitor Comparisons & Improvements Made

### 1. Pipeline Card Sidebar Preview (vs JobNimbus)

**What we found:** JobNimbus's kanban board lets users click any pipeline card to open a right-side preview panel showing job details, status controls, and a "Full Page" link. Users can triage dozens of leads without ever leaving the board view. Our pipeline required opening a full-page LeadDetail modal for every card, breaking flow.

**What changed:** Clicking a pipeline card now opens a right-side slide-in panel showing lead summary (name, phone, email, address), a stage selector for quick stage changes, storm data, recent activity, notes, and a "Full Detail" button that opens the existing LeadDetail modal. The panel closes with Escape or click-outside. This is a 310-line addition to Pipeline.jsx that fundamentally changes how users interact with the board.

**Where to see it:** Pipeline page — click any lead card to open the sidebar.

### 2. Stale Lead Alerts (vs RoofLink)

**What we found:** RoofLink triggers notifications when jobs haven't been touched in 3 or 7 days, keeping reps accountable and preventing leads from falling through the cracks. We had no aging alerts — leads could sit untouched indefinitely without anyone being notified.

**What changed:** Added a daily cron job (8am) that scans leads in active sales stages (new_lead through estimate_sent) for those untouched for 3+ days. Creates stale_lead notifications for the assigned rep, or broadcasts to all tenant users if unassigned. Includes 4-day deduplication to prevent notification spam. Added "Stale Lead Alerts" to the notification preferences in Settings.

**Where to see it:** Notifications bell — stale lead alerts appear automatically. Settings > Notifications to toggle the category.

### 3. Content Studio — Cold Call Scripts & Landing Pages (vs Rooftops.ai)

**What we found:** Rooftops.ai's Creator Studio includes cold call script generation and landing page building as two of its eight content tools. Our Content Studio had 10 content types (emails, social posts, door hangers, etc.) but lacked these two categories that sales teams use daily.

**What changed:** Added two new content types with full template libraries:
- **Cold Call Scripts:** 4 tone variants (Professional, Urgent, Friendly, Consultative) with 1-3 templates each. Each script has structured sections — Opening, Hook, Ask, Objection Handling, Close — rendered with color-coded section labels and a phone icon in the preview.
- **Landing Pages:** 4 tone variants with headline, subheadline, CTA, body copy, and testimonial fields. Preview renders as a realistic dark-themed page with hero section, formatted body content, and testimonial strip.

Backend: New templates and CONTENT_TYPES entries in contentService.js. Frontend: Two new preview components (ColdCallScriptPreview, LandingPagePreview) with updated type dropdown and preview routing.

**Where to see it:** Content Studio > Generate tab — select "Cold Call Script" or "Landing Page" from the type dropdown.

---

## New Features Built

All three features above were net-new additions to the application. No standalone new modules were built tonight — all work extended existing pages and services.

---

## Features Still Behind Competitors

### High Priority (Next Run)

- **In-person estimate signing** — SumoQuote and RoofLink allow customers to sign estimates on-screen immediately (tablet/phone) rather than waiting for an emailed link. Backend function is written (uncommitted in estimateService.js) but needs the frontend "Sign Now" button and signature canvas integration in the estimate review mode.

- **Automated invoice reminders** — JobNimbus sends automatic follow-ups for overdue invoices at 3/7/14 days. Low effort with existing drip sequence cron infrastructure. Not started.

- **Storm severity star rating** — HailTrace rates storms 1-5 stars based on max hail size, impacted structures, and damage probability. We have severity data but don't aggregate it into a simple rating. Would display on Storm Archive cards and map popups.

- **More hail swath color stops** — HailTrace uses 10 levels per quarter-inch. We use 4 color steps. Expanding to 8-10 stops would match their granularity.

### Medium Priority

- **Multi-page estimate proposals** — SumoQuote has 8 page types (cover, intro, inspection photos, terms, warranty, etc.). We have a single continuous builder. Adding a cover page with company logo and customer home photo would be the biggest visual upgrade.

- **Insurance-specific estimate fields** — RoofLink has ACV, recoverable depreciation, insurance proceeds, and overhead & profit fields. Critical for storm restoration contractors.

- **Profit Tracker dashboard section** — JobNimbus has detailed planned vs actual cost tracking with variance analysis and commission payouts. We track per-lead expenses but have no aggregated profit view.

- **Pipeline invoice/outstanding column totals** — JobNimbus shows Estimate Total, Invoice Total, and Outstanding per pipeline column. We only show estimated_value sums.

### Lower Priority

- **Action-typed work order milestones** — RoofLink has schedule, upload, checkbox, and document action types. We only have toggle and photo-required.
- **Crew role with limited visibility** — RoofLink charges $30/mo for crew logins that hide profit/cost data. We show everything to all users.
- **AI chat assistant** — Both JobNimbus (Scout) and Rooftops.ai offer AI assistants. Lightweight implementation possible with GPT-4o-mini.

---

## Where I Stopped

In-person estimate signing was in progress when the run ended. The backend function (`signEstimateInPerson`) is written in estimateService.js but not committed. It handles the database update, lead value sync, and auto work order creation. What remains:

1. Add the API route (POST endpoint in estimates routes)
2. Build the frontend "Sign Now" button in the estimate review toolbar
3. Open the existing signature canvas component inline (not via email link)
4. Test the full flow: review estimate > sign now > signature captured > status updated > work order auto-created

**Next run should start here**, then move to automated invoice reminders and storm severity star rating.
