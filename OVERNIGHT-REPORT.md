# Overnight Report — 2026-04-02

## Executive Summary

Tonight's run fixed 4 usability issues identified in the app inventory audit and competitor research. A broken "Needs Follow-up" filter was repaired, the unusable bulk "Assign Rep" text input was replaced with a team member dropdown (matching JobNimbus/RoofLink), all browser alert/confirm dialogs were replaced with in-app toast notifications and inline confirms, and a Profile edit form was added to Settings (every competitor has this). The competitor UI research document was also refreshed with current scrapes.

---

## Competitor Comparisons & Improvements Made

### 1. Bulk Assign Rep Dropdown (vs JobNimbus / RoofLink)

**Competitor studied:** Both JobNimbus and RoofLink allow bulk lead assignment via a dropdown that lists team members by name. Users select leads, pick a rep from a dropdown, and assign in one click.

**Before:** The bulk "Assign Rep" action in the Leads table opened a raw text input that expected users to paste a UUID. Completely unusable — no user would know their team member's UUID.

**What changed:** Replaced the UUID text input with a CustomSelect dropdown that fetches and displays all team member names. Selecting a rep and confirming assigns them to all checked leads.

**Where to see it:** Leads page — select multiple leads via checkbox, click "Assign Rep" in the bulk actions bar.

---

### 2. Toast Notifications Replace Browser Dialogs (vs All Competitors)

**Competitor studied:** Every modern competitor (JobNimbus, RoofLink, Rooftops.ai) uses custom modals and toast notifications. None use browser-native alert() or confirm() dialogs.

**Before:** Four places in the app used browser-native dialogs: AutomationSettings used confirm() for delete confirmation, LeadDetail used alert() twice for status page link feedback, and RoofDrawingTool used alert() for measurement errors. These dialogs blocked the UI thread and broke the glass aesthetic.

**What changed:** AutomationSettings now uses an inline Yes/No confirm pattern. LeadDetail and RoofDrawingTool use showToast() for success and error feedback.

**Where to see it:** Settings > Automations (delete an automation), Lead Detail (copy status page link), Roof Drawing Tool (measurement validation).

---

### 3. Profile Edit Form in Settings (vs All Competitors)

**Competitor studied:** JobNimbus, RoofLink, and Rooftops.ai all provide editable user profiles where users can update their name and email. This is table stakes for any SaaS product.

**Before:** The Settings > Profile tab was completely read-only. Users could see their name and email but had no way to update them.

**What changed:** Added an Edit/Save/Cancel flow to the Profile tab. Users click Edit, modify their name or email, and Save. The backend PATCH /api/auth/me endpoint validates and updates the user record. The form uses the existing glass design system (`.glass`, `.form-input`, `auth-btn` classes).

**Where to see it:** Settings > Profile tab — click the Edit button.

---

## New Features Built

No net-new features were built this run. All 4 commits were UX fixes and parity improvements identified from the app inventory audit.

---

## Bug Fixes

### Needs Follow-up Filter 500 Error

The "Needs Follow-up" quick filter button on the Leads page returned a server 500 error. Root cause: the filter queried an `outreach_log` table that was never migrated to production. The backend was rewritten to use the existing `activities` table instead, pulling direction from the metadata JSONB column. The same fix was applied to the dashboard's getActivity query.

---

## Features Still Behind Competitors

### High Priority
1. **Hail swath color graduation** (vs HailTrace) — Storm swaths render in a single uniform color. HailTrace uses color-graduated severity zones ("Purple Zones") that help roofers instantly identify the highest-damage areas. This is the #1 visual credibility gap on the map.
2. **Server-side PDF estimates** (vs JobNimbus/SumoQuote) — Estimates currently use browser print dialog. Competitors generate professional branded PDFs server-side. Needs pdfmake or similar integration.
3. **QuickBooks sync** (vs JobNimbus/RoofLink) — No accounting integration. Both major competitors push invoices to QuickBooks. Needs OAuth flow setup.

### Medium Priority
4. **In-app SMS threading** (vs JobNimbus Engage) — SMS currently opens the native phone app. JobNimbus has in-app two-way texting. Requires Twilio account and real per-message costs.
5. **LLM-powered content generation** (vs Rooftops.ai) — Content Studio uses templates, not AI. Rooftops.ai has GPT-powered content generation. Needs cheap LLM integration.
6. **Calendar appointment scheduling** (vs JobNimbus) — Calendar shows existing events but has no click-to-create or Google Calendar sync.
7. **Custom dashboard widgets** (vs RoofLink) — Dashboard layout is fixed. RoofLink allows drag-to-rearrange widget positioning.

### Lower Priority
8. **Per-layer opacity sliders on map** (vs HailTrace) — Single global opacity slider vs HailTrace's per-layer controls.
9. **Receipt photo upload on expenses** — Expense tracking has no receipt attachment capability.
10. **Recurring tasks** — Tasks are one-off only; no recurrence patterns.

---

## Where I Stopped

All 4 planned improvements from the app inventory were completed and committed. The competitor UI research document was refreshed. No work was left in progress.

**Next run should start at:**
1. Hail swath color graduation (highest-impact visual gap vs HailTrace)
2. Server-side PDF estimate generation (highest-impact professional quality gap)
3. QuickBooks OAuth + invoice sync (highest-impact integration gap)
