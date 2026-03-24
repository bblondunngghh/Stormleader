const fs = require('fs');
const path = require('path');

// Load API key
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/RESEND_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('No RESEND_API_KEY in .env'); process.exit(1); }
const apiKey = apiKeyMatch[1].trim();

const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#111827;color:#d1d5db;padding:40px;border-radius:16px;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#0ea5e9;margin:0;font-size:28px;">StormLeads Overnight Report</h1>
    <p style="color:#6b7280;margin:8px 0 0;font-size:14px;">Tuesday, March 24, 2026 &mdash; Killed early (90% session limit)</p>
    <div style="display:flex;justify-content:center;gap:24px;margin-top:16px;">
      <div style="text-align:center;">
        <div style="color:#22c55e;font-size:24px;font-weight:bold;">5</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Commits</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#0ea5e9;font-size:24px;font-weight:bold;">19</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Files Changed</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#f59e0b;font-size:24px;font-weight:bold;">+1,037</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Lines Added</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#ef4444;font-size:24px;font-weight:bold;">2/6</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Stages Done</div>
      </div>
    </div>
  </div>

  <div style="background:#1f2937;border-radius:12px;padding:24px;margin-bottom:24px;">
    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:0;font-size:20px;">Executive Summary</h2>
    <p style="line-height:1.6;">First test of the new <strong style="color:#f0f0f0;">staged execution approach</strong> &mdash; 6 independent stages instead of one giant prompt. Completed Stage 1 (Competitor Research, 36 turns) and most of Stage 2 (Feature Implementation) before hitting the 90% session limit. Killed manually to preserve quota. The staged approach is working &mdash; the agent built real features instead of declaring victory after 22 turns like previous runs.</p>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">Stage Results</h2>
    <div style="background:#0d1117;border-radius:8px;padding:16px;margin:12px 0;">
      <p style="margin:4px 0;"><strong style="color:#22c55e;">Stage 1: Competitor Research</strong> &mdash; 36 turns, completed</p>
      <p style="margin:4px 0;"><strong style="color:#f59e0b;">Stage 2: Feature Implementation</strong> &mdash; in progress when killed (~17 min, 4 commits)</p>
      <p style="margin:4px 0;color:#6b7280;">Stage 3: Visual UI Audit &mdash; not started</p>
      <p style="margin:4px 0;color:#6b7280;">Stage 4: Storm Map + Data Sources &mdash; not started</p>
      <p style="margin:4px 0;color:#6b7280;">Stage 5: Security + Polish &mdash; not started</p>
      <p style="margin:4px 0;color:#6b7280;">Stage 6: Report Writing &mdash; not started</p>
    </div>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">Competitor Analysis Updated</h2>
    <p style="line-height:1.6;">Updated docs/competitor-gap-analysis.md with verified pricing and corrections for JobNimbus, HailTrace, RoofLink, and Rooftops.ai.</p>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">New Features Built</h2>

    <h3 style="color:#a882ff;margin-top:20px;font-size:16px;">1. Subcontractor Management</h3>
    <p style="line-height:1.6;">Full CRUD for managing subcontractors &mdash; add subs with name, trade, phone, email, rate, and notes. Assign subs to work orders directly. New page at /subcontractors with the glass table UI. Backend includes migration, service layer, and routes. This fills a gap vs JobNimbus which has subcontractor tracking built in.</p>

    <h3 style="color:#a882ff;margin-top:20px;font-size:16px;">2. Google Review Request Automation</h3>
    <p style="line-height:1.6;">When a job moves to "completed" stage, the system can automatically send a Google review request to the customer. Added to the CRM routes and Lead Detail page. This is a feature competitors charge extra for.</p>

    <h3 style="color:#a882ff;margin-top:20px;font-size:16px;">3. PWA &mdash; Install to Home Screen</h3>
    <p style="line-height:1.6;">Added a manifest.json and service worker so roofers can install StormLeads to their phone home screen like a native app. No app store needed. Huge win for field use.</p>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">Bug Fixes</h2>
    <ul style="padding-left:20px;margin:8px 0;">
      <li style="margin:4px 0;line-height:1.6;"><strong style="color:#f0f0f0;">EstimatesView crash</strong> &mdash; Fixed a crash caused by materialsApi.getProducts being called when it doesn't exist</li>
      <li style="margin:4px 0;line-height:1.6;"><strong style="color:#f0f0f0;">CreateLeadModal animation</strong> &mdash; Removed duplicate animation causing a visual glitch</li>
    </ul>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">Script Improvements</h2>
    <p style="line-height:1.6;">Rewrote run-overnight.sh from a single-prompt approach to <strong style="color:#f0f0f0;">6 sequential stages</strong>. Each stage is a separate Claude invocation with a focused task. Also reduced to 50 max turns per stage for future runs, and added resume memory so stages write progress for the next night to pick up.</p>

    <h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">Still Needs Attention</h2>
    <ul style="padding-left:20px;margin:8px 0;">
      <li style="margin:4px 0;line-height:1.6;">Visual UI audit (Stage 3) &mdash; highest priority for next run</li>
      <li style="margin:4px 0;line-height:1.6;">Storm map FEMA performance fix (Stage 4) &mdash; properties still load outside swaths</li>
      <li style="margin:4px 0;line-height:1.6;">Security review (Stage 5) &mdash; not started</li>
      <li style="margin:4px 0;line-height:1.6;">Nav consolidation features (contracts, expenses, milestones) &mdash; not built yet</li>
    </ul>
  </div>

  <details style="margin-top:16px;">
    <summary style="color:#6b7280;cursor:pointer;font-size:13px;">Commits</summary>
    <pre style="background:#0d1117;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;margin-top:8px;color:#8b949e;">4f1b2db feat: add PWA manifest and service worker for mobile install-to-home-screen
c1797f2 feat: add subcontractor management with CRUD, work order assignment, and UI
adfc207 feat: add Google review request automation for completed jobs
1a6b64b fix: resolve EstimatesView materialsApi.getProducts crash and CreateLeadModal duplicate animation
2295558 docs: update competitor analysis with verified pricing and corrections</pre>
  </details>

  <hr style="border:1px solid #2a2a4a;margin:24px 0;">
  <p style="color:#6b7280;font-size:12px;text-align:center;">
    Revert: <code style="background:#1f2937;padding:2px 6px;border-radius:4px;">git reset --hard pre-overnight-20260324</code>
  </p>
</div>`;

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: 'StormLeads Overnight Report — 5 commits, 2/6 stages — Mar 24, 2026',
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Email sent (id: ' + d.id + ')' : 'Email failed: ' + JSON.stringify(d));
}).catch(e => console.error('Email send failed:', e.message));
