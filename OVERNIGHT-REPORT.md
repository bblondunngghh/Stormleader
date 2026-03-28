# Overnight Report — 2026-03-28

## Executive Summary

Tonight's session delivered five feature improvements across Pipeline, Reports, Work Orders, Dashboard, and Lead List — all driven by direct competitor comparison against JobNimbus and RoofLink. A fresh competitor UI research document and full app inventory were also produced to guide prioritization.

## Competitor Comparisons & Improvements Made

### 1. Pipeline Task Progress + Mobile List View (vs JobNimbus)
- **What we found:** JobNimbus shows task completion indicators on every kanban card and has a full mobile experience. Our pipeline cards only showed value and days-in-stage, and the mobile "List" toggle was stubbed but never built.
- **What changed:** Added task completion badges (e.g., "2/5 tasks") with color coding to every pipeline card. Built out the mobile list view with priority dots, days-in-stage, task progress, and deal value — previously it was a dead button.
- **Where to see it:** Pipeline page — desktop kanban cards and mobile view toggle.

### 2. Reports Comparison Periods with Trend Arrows (vs JobNimbus)
- **What we found:** JobNimbus has comparison periods showing how metrics changed vs. prior timeframes. Our Reports page had static charts with no benchmarking.
- **What changed:** Added a "Compare" toggle that fetches previous-period data automatically. Revenue, Pipeline, and Conversion charts now show current vs. prior period with arrow indicators (up/down/flat) and percentage change.
- **Where to see it:** Reports page — click the Compare toggle in the toolbar.

### 3. Work Order Line Item Editing (vs RoofLink)
- **What we found:** RoofLink's production workflow has full editable line items on work orders. Our work order detail modal showed line items as read-only.
- **What changed:** Replaced the read-only display with an editable grid supporting description, quantity, and unit price fields. Users can add/remove items with a running total and save button.
- **Where to see it:** Work Orders page — open any work order detail modal.

### 4. Dashboard Monthly Revenue Goal (vs JobNimbus)
- **What we found:** JobNimbus dashboards include revenue tracking and goal-setting. Our dashboard showed stats but had no target-based progress tracking.
- **What changed:** Added a revenue goal progress bar between stat cards and pipeline funnel. Users set a monthly target via inline edit. Shows completion percentage, remaining amount, and an on-track/behind-pace indicator based on day of month. Stored in localStorage (zero database cost).
- **Where to see it:** Dashboard — the progress bar below the stat cards.

### 5. Saved Filter Presets for Leads (vs JobNimbus)
- **What we found:** JobNimbus lets users save filtered views as named lists for reuse in marketing campaigns. Our lead list had URL-synced filters but no way to save or recall filter combinations.
- **What changed:** Added bookmark-style saved filter presets. Users can save current filter combinations (stage, priority, source, score, search) as named presets and restore them with one click. Stored in localStorage (zero database cost).
- **Where to see it:** Leads page — preset pills appear above the filter bar when presets are saved.

## New Features Built

No net-new features were built this session. All five commits were improvements to existing feature areas based on competitive gaps.

## Features Still Behind Competitors

Based on the updated competitor UI research and app inventory, these are the highest-priority remaining gaps:

1. **PDF export for estimates** — JobNimbus and SumoQuote generate proper PDFs. We only have print-to-PDF. Server-side PDF generation with pdfmake is the fix.
2. **Inspection photo pages in estimates** — JobNimbus has dedicated photo layout sections with drag-reorder and descriptions. We have no photo sections in estimates.
3. **In-app SMS threading** — JobNimbus has full SMS send/receive. We use native `sms:` protocol links only.
4. **Content library cloud sync** — Content Studio library is localStorage-only. Rooftops.ai has cloud-persisted content.
5. **Chart drill-down in reports** — Clicking a bar or funnel segment should navigate to a filtered lead list. Currently static charts only.
6. **Milestone templates for work orders** — Common job types (shingle tear-off, flat roof, etc.) should have predefined milestone sets.

## Where I Stopped

All five planned improvements were completed and committed. The competitor UI research document was updated with a fresh second pass, and a full app inventory was produced. No feature was left in progress.

**Next run should start at:** PDF export for estimates (highest remaining competitive gap), then inspection photo pages, then in-app SMS threading.
