# StormLeads Overnight Report — March 26, 2026 (Run 2)

## Executive Summary

Tonight's session conducted a comprehensive competitor UI research audit across HailTrace, JobNimbus, RoofLink, and Rooftops.ai, identifying 10 prioritized improvement areas. Three high-impact features were then implemented directly from those findings: pipeline stage conversion rates, work order milestone photo uploads, and drip sequence merge fields with improved UX. A full 39-page app inventory was also completed to baseline every feature against competitors.

## Competitor Comparisons & Improvements Made

### 1. Pipeline Stage Conversion Rates (vs HailTrace + JobNimbus)

**What we found:** HailTrace displays percentage change between pipeline stages and per-stage revenue totals. JobNimbus shows "estimated totals" on their kanban boards. Both competitors treat the pipeline as a revenue tracking tool, not just a lead organizer.

**Before:** Pipeline showed kanban cards with name, address, priority, and source badges. No financial data, no conversion metrics between stages.

**After:** Each pipeline column now displays a color-coded conversion rate percentage between stages (green for high conversion, red for low). This immediately shows where leads are getting stuck in the funnel — a key insight competitors charge premium prices to deliver.

**Where to see it:** Pipeline page — look between the kanban column headers for conversion percentages.

### 2. Dashboard Stat Card Change Indicators (vs HailTrace)

**What we found:** HailTrace shows directional percentage change from previous period on every dashboard metric. Their dashboard cards include up/down arrows with color coding.

**Before:** Dashboard stat cards showed current values only with no trend indicators.

**After:** Stat cards now show directional arrows and color-code positive changes (green) vs negative changes (red) vs neutral. This gives an at-a-glance sense of business trajectory.

**Where to see it:** Dashboard — each of the four stat cards now has a change indicator badge.

### 3. Work Order Photo Upload (vs RoofLink)

**What we found:** RoofLink's production workflow requires photo verification at specific milestones — crews must upload photos of tear-off, underlayment, and nail pattern before they can request payment. This is a gating mechanism that prevents payment disputes.

**Before:** The photo upload button on work order milestones showed a "coming soon" toast. The feature was completely non-functional.

**After:** Photo upload is fully wired up. The camera button accepts photos from file picker or mobile camera, uploads via the existing document API, saves the URL to the milestone record, and displays a clickable thumbnail when complete. The icon turns green when a photo exists. Photos can be retaken.

**Where to see it:** Work Orders — open any work order detail, expand milestones, click the camera icon.

### 4. Drip Sequence UX + Merge Fields (vs JobNimbus)

**What we found:** JobNimbus offers merge fields in their email automation and polished modal-based workflows. StormLeads was using raw browser confirm() dialogs for delete actions and had no merge field support in drip emails.

**Before:** Deleting a drip sequence triggered a browser confirm() popup — jarring and inconsistent with the glass UI design. Email templates were plain text with no personalization tokens.

**After:** Delete confirmations now use a proper glass-styled modal dialog matching the app's design system. A merge field insertion toolbar with 10 fields (first name, last name, email, phone, address, city, state, zip, company, source) appears above email subject and body fields. The backend replaces merge tokens with actual lead data at send time.

**Where to see it:** Settings → Drip Sequences — edit any sequence step to see merge fields; try deleting a sequence to see the new confirmation modal.

## New Features Built

No net-new features were built this session. All work was competitor-driven improvements to existing features.

## Features Still Behind Competitors

### Not Yet Addressed (from tonight's research)

1. **Deal value on pipeline cards + column revenue totals** — Both JobNimbus and HailTrace show dollar amounts per card and total revenue per stage column. This was the #1 priority item identified but was not implemented tonight. Requires linking estimate totals to pipeline card display.

2. **Good/Better/Best estimate tiers** — RoofLink's signature feature: generate three estimate variants (Silver/Gold/Platinum) from a single measurement. StormLeads creates one estimate at a time with no tiered presentation.

3. **Property Report Generator** — Rooftops.ai's core product is instant roof reports from an address. StormLeads has all the underlying data (Google Solar, weather history, FEMA, Census) but doesn't bundle it into a shareable report.

4. **Editable work order checklists** — RoofLink uses templated checklists per job type with gating requirements. StormLeads milestones are still read-only (photo upload works, but milestone items can't be created or edited by users).

5. **Invoice payment reminders** — JobNimbus sends automated overdue invoice emails. StormLeads has the email infrastructure but no automated reminder triggers.

6. **Estimate → Work Order auto-creation** — RoofLink auto-generates work orders when estimates are approved. StormLeads has "create from estimate" but it's a manual step.

7. **Storm archive/catalog page** — HailTrace has a browsable, searchable archive of every mapped storm with preview thumbnails. StormLeads shows storms on the map but has no catalog view.

8. **QuickBooks sync** — Both JobNimbus and RoofLink offer QuickBooks integration as standard. StormLeads has no accounting system integration.

9. **SMS/texting** — JobNimbus Engage provides shared inbox texting with automation triggers. StormLeads is email-only.

10. **Dashboard drill-down** — Clicking stat cards should navigate to filtered views. Currently display-only.

### Priority for Next Run

1. Deal value on pipeline cards + column totals (Low effort, Critical)
2. Good/Better/Best estimate tiers (Medium effort, High impact)
3. Property Report Generator bundling existing free data (Medium effort, High impact)
4. Invoice payment reminders using existing email infrastructure (Low effort, High impact)
5. Estimate → Work Order auto-creation on approval (Low effort, Medium impact)

## Where I Stopped

The session completed all three implementation tasks that were prioritized from the competitor research. The competitor UI research document and app inventory are committed and comprehensive.

**Next run should start at:** Deal value display on pipeline cards and column revenue totals — this is the #1 gap identified and requires relatively low effort (pull estimate total from the lead's linked estimates, display on the kanban card and sum in the column header).
