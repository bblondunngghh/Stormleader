# Overnight Report — 2026-03-27

## Executive Summary

Tonight's session focused on closing the top competitor UI gaps identified in refreshed competitor research. Three feature improvements were shipped — pipeline board tabs matching JobNimbus's multi-board workflow, a content library matching Rooftops.ai's Creator Library, and dashboard loading skeletons matching the progressive loading UX seen in JobNimbus and HailTrace dashboards.

## Competitor Comparisons & Improvements Made

### 1. Pipeline Board Tabs (vs JobNimbus)

**What we found:** JobNimbus separates its pipeline into three distinct boards — Sales, Production, and Billing — each showing only the stages relevant to that workflow phase. Cards display days-in-stage to surface bottlenecks, and column headers show estimated totals.

**Before:** StormLeads had a single kanban board showing all pipeline stages in one view. No way to focus on just sales vs production vs billing workflows. No visibility into how long leads had been sitting in a stage.

**What changed:** Added a tab switcher at the top of the Pipeline page with Sales, Production, and Billing views. Each tab filters the kanban to show only relevant stages. Every pipeline card now displays a days-in-stage badge with color coding — green for today, gray for 1–6 days, amber for 7–13 days, and red for 14+ days (stale). This surfaces bottlenecks at a glance.

**Where to see it:** Pipeline page — click the Sales / Production / Billing tabs above the kanban columns.

### 2. Content Library (vs Rooftops.ai)

**What we found:** Rooftops.ai offers a "Creator Library" where users can save generated AI content (social posts, emails, scripts) and retrieve it later. This turns one-time content generation into a reusable asset library.

**Before:** StormLeads Content Studio could generate AI marketing content but had no way to save or organize it. Every generation was use-it-or-lose-it.

**What changed:** Added a Library tab to Content Studio. Users can now save any generated content to a persistent library with type and tone tags. The library supports text search, type filtering, copy-to-clipboard, and delete. Content cards display type badge, tone badge, and save date in a responsive grid layout.

**Where to see it:** Content Studio page — click the "Library" tab to view saved content, or use the save button on any generated content.

### 3. Dashboard Loading Skeletons (vs JobNimbus / HailTrace)

**What we found:** Both JobNimbus and HailTrace dashboards load progressively with skeleton placeholders, preventing empty-state flashes and giving users immediate visual feedback that data is loading.

**Before:** StormLeads Dashboard showed empty containers or brief content flashes while API data loaded, which felt unpolished compared to competitors.

**What changed:** Added animated skeleton placeholders with shimmer gradients for all dashboard sections — stat cards, pipeline funnel bars, storm map panel, and activity feed. Content is hidden during loading and revealed once data arrives, eliminating the empty-state flash.

**Where to see it:** Dashboard page — visible on initial load before data arrives.

## New Features Built

No net-new features were built tonight. All three changes were competitive improvements to existing features.

## Features Still Behind Competitors

### High Priority (not reached this session)

1. **Deal value on pipeline cards + column revenue totals** — JobNimbus shows estimated dollar value per card and per column header. Our pipeline cards still lack revenue visibility. This was the #1 priority gap but requires wiring estimate totals to lead/pipeline queries.

2. **Good/Better/Best estimate tiers** — SumoQuote and JobNimbus offer multi-option estimates where homeowners choose between pricing tiers. Our estimate builder creates single-option estimates only.

3. **Storm swath color graduation by severity** — HailTrace color-grades storm polygons by hail size (green to yellow to orange to red). Our swaths use uniform coloring regardless of severity.

4. **Property filtering on the storm map** — HailTrace allows filtering map pins by stage, assigned rep, last impact date, and shingle type. Our map shows all properties uniformly with no filter controls.

5. **PDF export for estimates, invoices, and contracts** — JobNimbus and RoofLink offer one-click PDF generation. We have screen-rendered documents but no downloadable PDF output.

### Medium Priority

6. **Inspection photo pages in estimates** — SumoQuote embeds roof inspection photos directly into estimate documents. Our estimates are text/line-item only.

7. **Report export with comparison periods** — HailTrace offers CSV/PDF report exports with period-over-period comparisons. Our Reports page shows data but has no export or date-range comparison.

8. **Online payment collection on invoices** — JobNimbus and RoofLink support credit card payment directly on customer-facing invoices. Our invoices are view-only.

## Where I Stopped

All three planned implementations for this session were completed. The competitor research document was refreshed with new Firecrawl scrapes at the start of the session, then three features were built in priority order from the gap list.

**Next session should start at:** Deal value on pipeline cards + column revenue totals (the #1 remaining gap). This requires modifying the pipeline API to join estimate totals to lead records and displaying dollar amounts on each kanban card and column header.
