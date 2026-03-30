# Overnight Report — 2026-03-30

## Executive Summary

Tonight's run closed 5 competitor gaps identified in the updated app inventory and UI research. Dashboard filter controls (vs JobNimbus Insights), A/R invoice aging (vs JobNimbus), photo-required milestone stops (vs RoofLink), storm catalog severity ratings and filtering (vs HailTrace), and Content Studio sidebar discovery were all shipped. Backend work for LeadList quick filters is written but uncommitted.

---

## Competitor Comparisons & Improvements Made

### 1. Dashboard Filter Controls (vs JobNimbus Insights)

**Competitor studied:** JobNimbus Sales Dashboard filters all widgets by sales rep, job type, lead source, and date range. Managers use this to evaluate individual rep performance and source ROI.

**Before:** Dashboard showed aggregate stats only. No way to slice data by rep, source, or time period. Managers had to mentally filter or export to Excel.

**What changed:** Added three filter dropdowns to the dashboard header — Rep, Source, and Time Period. All stat cards, funnel, and activity widgets now respect these filters. Backend dashboard service accepts `rep_id`, `source`, and `period` query parameters and applies them to all queries.

**Where to see it:** Dashboard page — filter bar below the page header.

**Follow-up fix:** Native `<select>` elements were replaced with the project's `CustomSelect` component to maintain glassmorphism design consistency.

---

### 2. A/R Aging Summary (vs JobNimbus)

**Competitor studied:** JobNimbus sorts overdue invoices into aging buckets (Current, 1-30, 31-60, 61-90, 91+ days) with summary totals. Standard accounting view that contractors and bookkeepers expect.

**Before:** Invoices page had overdue badges on individual invoices but no aging analysis or summary view.

**What changed:** Added an A/R aging summary bar with 5 buckets: Current, 1-30 Days, 31-60 Days, 61-90 Days, and 91+ Days. Each bucket shows count and dollar total, color-coded from green (current) to red (91+).

**Where to see it:** Invoices page — aging summary appears above the invoice list.

---

### 3. Photo-Required Milestone Stops (vs RoofLink)

**Competitor studied:** RoofLink's production workflow blocks stage advancement if required photos haven't been uploaded. Crews can't mark "Install Complete" without install photos.

**Before:** Work order milestones could be marked complete without any documentation.

**What changed:** Added a `photo_required` flag to milestone templates. When enabled, the milestone cannot be toggled complete unless at least one photo has been uploaded. Camera icon badge on required milestones with warning on attempted completion without photos. Database migration adds the column, backend enforces the constraint.

**Where to see it:** Work Orders — open any work order detail; milestones with the camera badge require photos before completion.

---

### 4. Storm Catalog Severity Ratings, Type Filters, and Sorting (vs HailTrace)

**Competitor studied:** HailTrace uses a 1-5 star rating per storm based on affected properties, max hail size, and damage probability. They offer filtering by storm type and severity.

**Before:** Storm catalog was a flat, unsortable list of storm cards. No severity rating, no type filter, no sort options.

**What changed:** Added a severity rating algorithm (1-5 scale) based on max hail size, wind speed, and tornado presence. Added type filter dropdown (All, Hail, Wind, Tornado). Added sort options (Newest, Oldest, Most Severe, Largest Hail, Highest Wind). Severity badges display as colored pills on each card.

**Where to see it:** Storm Catalog page — filter and sort controls at the top, severity badges on each card.

---

### 5. Content Studio Sidebar Link (Discovery Fix)

**Before:** Content Studio was fully built but only accessible via direct URL `/content-studio`. Not discoverable.

**What changed:** Added Content Studio to the sidebar navigation menu.

**Where to see it:** Sidebar navigation.

---

## New Features Built

No net-new feature categories were built this session. All work was targeted gap-closing on existing pages based on the competitor research prioritization.

---

## Features Still Behind Competitors

### High Priority
1. **QuickBooks Sync** — JobNimbus and RoofLink both sync invoices. The #1 integration gap preventing adoption by established contractors. Free developer tier available.
2. **Server-Side PDF Estimates** — Current "PDF" is browser print dialog. JobNimbus/SumoQuote generate branded multi-page PDFs with cover pages, photos, and terms. Most visible quality gap to customers.
3. **In-App SMS Texting** — JobNimbus charges $49-249/mo for Engage. Twilio costs ~$0.0075/msg. Field teams' #1 requested feature.
4. **Hail Swath Color Graduation** — HailTrace color-codes swaths by hail size. Our swaths are uniform color. Key visual credibility signal.

### Medium Priority
5. **Calendar Appointment Scheduling** — Calendar shows events but can't create appointments. Field teams need click-to-create.
6. **AI-Powered Content Generation** — Content Studio uses templates, not LLM generation. Rooftops.ai and QuoteIQ both have AI content.
7. **Profile Tab Edit Mode** — Settings > Profile is read-only. Users can't change name or password.
8. **Receipt Upload on Expenses** — No file attachment. Contractors photograph receipts constantly.

### Lower Priority
9. **Recurring Tasks** — JobNimbus has daily/weekly/monthly recurrence.
10. **Google Calendar Sync** — Complex OAuth but high value.

---

## Where I Stopped

### In Progress: LeadList Quick Filters Backend

Backend code for `needs_followup`, `unassigned`, `source`, and `score_min` query parameters has been written in the leads route and service but is **not committed**. The `needs_followup` filter finds leads with no outreach or last outreach older than 3 days. The `unassigned` filter finds leads with no assigned rep.

**Next run should:**
1. Test the uncommitted quick filter changes, verify, and commit
2. Wire frontend LeadList quick filter buttons to the new backend parameters
3. Move to server-side PDF estimates (highest quality gap)
4. Then QuickBooks sync (highest integration gap)
