# Overnight Report — 2026-04-05

## Executive Summary

Tonight's run completed 4 competitive features identified as top quick wins in the app inventory audit: in-person estimate signing (finishing work started on 2026-04-04), calendar click-to-create task scheduling, contract PDF generation, and an enhanced payment recording modal. All four features directly close gaps against SumoQuote and JobNimbus. A UI consistency check confirmed all changes pass the project's glass/oklch/component standards. Total: 4 feature commits + 1 docs commit, 1,435 lines added across 10 files.

---

## Competitor Comparisons & Improvements Made

### 1. In-Person Estimate Signing (vs SumoQuote)

**What we found:** SumoQuote allows contractors to present estimates on a tablet and have customers sign on-screen immediately, avoiding the delay of emailing a link and waiting. Our estimate signing flow required sending a link to the customer — no in-person option existed despite the backend function being coded in a prior session.

**What changed:** Wired the previously-uncommitted backend function to a proper API route. Built a full "Sign Now" modal in EstimatesView with a canvas-based signature pad (draw with mouse or touch), clear button, and submit flow. On signature submission, the estimate is marked as signed, the lead's estimated value updates, and a work order is auto-created. The modal uses glass styling with modal-backdrop animation.

**Where to see it:** Estimates page — click any sent estimate, then hit the "Sign Now" button. A signature canvas modal opens for on-screen signing.

### 2. Calendar Click-to-Create Task (vs JobNimbus Scheduling)

**What we found:** JobNimbus lets users click any calendar date or time slot to instantly create a task or appointment. Our calendar displayed existing tasks but had no click-to-create — users had to leave the calendar, navigate to Tasks, and create a task there, then return to verify the date.

**What changed:** Added a dateClick handler that opens a pre-filled task creation modal when any calendar date is clicked. The modal pre-populates the due date from the clicked date and includes all fields (title, description, priority, lead assignment, due date/time) using the project's CustomSelect and DatePicker components. Also added an illustrated empty state guiding users to click a date to get started.

**Where to see it:** Calendar page — click any date cell to open the new task creation modal.

### 3. Contract PDF Generation (vs SumoQuote)

**What we found:** SumoQuote generates polished, branded PDF documents for contracts and proposals. Our contracts existed only as on-screen records with no download or print capability — contractors had no way to produce a professional document for customers or email attachments.

**What changed:** Built a server-side PDF generation endpoint using pdfmake (matching the pattern established for estimate PDFs). The generated contract PDF includes company branding, customer information, contract scope/terms, line items with pricing, signature blocks for both parties, and warranty language. Frontend adds a "Download PDF" button on each contract card.

**Where to see it:** Contracts page — click the download button on any contract to generate and download a branded PDF.

### 4. Enhanced Payment Recording Modal (vs JobNimbus)

**What we found:** JobNimbus has a comprehensive payment recording interface with payment method selection (check, credit card, cash, financing), partial payment tracking, and payment notes. Our invoice payment modal was a bare-bones stub that didn't capture how payment was received or allow notes.

**What changed:** Rebuilt the payment recording modal with a payment method selector (check, credit card, cash, ACH, financing, other), quick-fill button to auto-populate the remaining balance, editable amount field, reference number for checks/ACH, and a notes field. The modal uses glass styling with modal-scale-in animation, and all form inputs use the project's standard classes and components.

**Where to see it:** Invoices page — click "Record Payment" on any invoice to see the enhanced modal.

---

## New Features Built

All four features extended existing pages rather than creating new modules. The contract PDF endpoint is the only net-new backend route, complementing the existing estimate PDF generation endpoint.

---

## Features Still Behind Competitors

### High Priority

- **QuickBooks sync** — JobNimbus and RoofLink both offer direct QuickBooks integration for invoice and expense sync. This is the #1 integration gap. Requires OAuth flow setup.

- **SMS/texting** — JobNimbus, RoofLink, and Rooftops.ai all have built-in SMS. Our SMS composer UI exists in LeadDetail but sends nothing. Requires Twilio account (~$0.0075/msg).

- **Automated invoice reminders** — JobNimbus auto-sends follow-ups for overdue invoices at configurable intervals. Low effort with existing cron infrastructure from drip sequences.

- **Multi-page estimate proposals** — SumoQuote offers 8 page types (cover, intro, inspection photos, scope, options, terms, warranty, acceptance). Our estimates are a single continuous builder. A cover page would be the biggest visual upgrade.

### Medium Priority

- **Insurance-specific estimate fields** — RoofLink has ACV, recoverable depreciation, insurance proceeds, and O&P fields. Critical for storm restoration contractors.

- **Pipeline invoice/outstanding column totals** — JobNimbus shows financial totals per pipeline column. We show estimated_value sums but not invoice data.

- **Storm severity star rating** — HailTrace rates each storm 1-5 stars. We have severity data but no aggregated star rating on storm cards.

- **AI chat assistant** — Both JobNimbus (Scout) and Rooftops.ai offer AI assistants for quick answers and content generation.

### Lower Priority

- **Crew role with limited visibility** — RoofLink hides profit/cost data from crew logins.
- **Action-typed work order milestones** — RoofLink has schedule, upload, checkbox, and document action types.
- **Good/Better/Best estimate comparison** — SumoQuote's side-by-side tier comparison is more polished than ours.

---

## Where I Stopped

All four planned implementations from the inventory quick-wins list are complete. The UI consistency check (Stage 4) confirmed all changes pass glass/oklch/component standards with no fixes needed. The build is green.

**Next run should start at:**
1. Automated invoice reminders (low effort — reuse drip sequence cron pattern)
2. QuickBooks sync (high effort — OAuth flow, but biggest integration gap)
3. SMS/texting via Twilio adapter (medium effort — UI already exists, needs backend)
4. Multi-page estimate proposals with cover page (medium effort — extends existing builder)
