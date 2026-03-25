const fs = require('fs');
const path = require('path');

// Load API key
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/RESEND_API_KEY=(.+)/);
if (!apiKeyMatch) { console.log('No RESEND_API_KEY — skipping email'); process.exit(0); }
const apiKey = apiKeyMatch[1].trim();

// Load args from temp file
const args = JSON.parse(fs.readFileSync('/tmp/overnight-email-args.json', 'utf8'));
const { commits, today, tagDate, totalTurns, totalCost, stageBreakdown } = args;

// Load report
const report = fs.existsSync('OVERNIGHT-REPORT.md')
  ? fs.readFileSync('OVERNIGHT-REPORT.md', 'utf8')
  : 'No report generated.';

// Convert markdown to styled HTML
function mdToHtml(md) {
  return md
    .replace(/</g, '&lt;')
    .replace(/^## (.+)$/gm, '<h2 style="color:#0ea5e9;border-bottom:1px solid #2a2a4a;padding-bottom:8px;margin-top:32px;font-size:20px;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#a882ff;margin-top:20px;font-size:16px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f0f0f0;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;line-height:1.6;">$1</li>')
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="padding-left:20px;margin:8px 0;">$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;line-height:1.6;">$1</li>')
    .replace(/^(?!<[hul]|<li|<strong)(.+)$/gm, '<p style="margin:8px 0;line-height:1.6;">$1</p>');
}

const commitLines = commits.split('\n').filter(l => l.trim());
const commitCount = commitLines.length;

// Count files changed from git
const { execSync } = require('child_process');
let filesChanged = '?';
let linesAdded = '?';
try {
  const diffStat = execSync(`git diff --shortstat overnight-checkpoint-${tagDate}..HEAD 2>/dev/null`, { encoding: 'utf8' }).trim();
  const filesMatch = diffStat.match(/(\d+) files? changed/);
  const insertMatch = diffStat.match(/(\d+) insertions?/);
  if (filesMatch) filesChanged = filesMatch[1];
  if (insertMatch) linesAdded = '+' + Number(insertMatch[1]).toLocaleString();
} catch (e) {}

// Count stages completed
const stageFiles = ['s1-competitors', 's2-features', 's3-ui-audit', 's4-stormmap', 's5-security', 's6-report'];
let stagesCompleted = 0;
const stageDetails = stageFiles.map(s => {
  const file = `claude-overnight-${tagDate}-${s}.json`;
  try {
    const d = require(path.join(__dirname, file));
    stagesCompleted++;
    return { name: s, turns: d.num_turns || 0, cost: d.total_cost_usd || 0, stop: d.stop_reason || '?' };
  } catch {
    return { name: s, turns: 0, cost: 0, stop: 'not run' };
  }
});

const stageRowsHtml = stageDetails.map(s => {
  const color = s.stop === 'not run' ? '#6b7280' : s.stop === 'end_turn' ? '#22c55e' : '#f59e0b';
  const label = s.name.replace('s1-', '1. ').replace('s2-', '2. ').replace('s3-', '3. ').replace('s4-', '4. ').replace('s5-', '5. ').replace('s6-', '6. ')
    .replace('competitors', 'Competitors').replace('features', 'Features').replace('ui-audit', 'UI Audit')
    .replace('stormmap', 'Storm Map').replace('security', 'Security').replace('report', 'Report');
  if (s.stop === 'not run') {
    return `<p style="margin:4px 0;color:#6b7280;">${label} &mdash; not started</p>`;
  }
  return `<p style="margin:4px 0;"><strong style="color:${color};">${label}</strong> &mdash; ${s.turns} turns, $${s.cost.toFixed(2)}</p>`;
}).join('\n');

const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;background:#111827;color:#d1d5db;padding:40px;border-radius:16px;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#0ea5e9;margin:0;font-size:28px;">StormLeads Overnight Report</h1>
    <p style="color:#6b7280;margin:8px 0 0;font-size:14px;">${today}</p>
    <div style="display:flex;justify-content:center;gap:24px;margin-top:16px;">
      <div style="text-align:center;">
        <div style="color:#22c55e;font-size:24px;font-weight:bold;">${commitCount}</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Commits</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#0ea5e9;font-size:24px;font-weight:bold;">${filesChanged}</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Files Changed</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#f59e0b;font-size:24px;font-weight:bold;">${linesAdded}</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Lines Added</div>
      </div>
      <div style="text-align:center;">
        <div style="color:#ef4444;font-size:24px;font-weight:bold;">${stagesCompleted}/6</div>
        <div style="color:#6b7280;font-size:11px;text-transform:uppercase;">Stages Done</div>
      </div>
    </div>
  </div>

  <div style="background:#1f2937;border-radius:8px;padding:20px;margin-bottom:24px;">
    <h3 style="color:#a882ff;margin-top:0;font-size:14px;">Stage Breakdown</h3>
    ${stageRowsHtml}
    <hr style="border:1px solid #2a2a4a;margin:12px 0;">
    <p style="margin:4px 0;"><strong style="color:#f0f0f0;">Total:</strong> ${totalTurns} turns &mdash; $${Number(totalCost).toFixed(2)}</p>
  </div>

  <div style="background:#1f2937;border-radius:12px;padding:24px;margin-bottom:24px;">
    ${mdToHtml(report)}
  </div>

  <details style="margin-top:16px;">
    <summary style="color:#6b7280;cursor:pointer;font-size:13px;">Commits</summary>
    <pre style="background:#0d1117;padding:16px;border-radius:8px;font-size:12px;overflow-x:auto;margin-top:8px;color:#8b949e;">${commits.replace(/</g, '&lt;')}</pre>
  </details>

  <hr style="border:1px solid #2a2a4a;margin:24px 0;">
  <p style="color:#6b7280;font-size:12px;text-align:center;">
    Revert: <code style="background:#1f2937;padding:2px 6px;border-radius:4px;">git reset --hard pre-overnight-${tagDate}</code>
  </p>
</div>`;

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'StormLeads <reports@accessvaletparking.com>',
    to: ['brandon@accessvaletparking.com'],
    subject: `StormLeads Overnight Report \u2014 ${commitCount} commits, ${stagesCompleted}/6 stages \u2014 ${today}`,
    html: html
  })
}).then(r => r.json()).then(d => {
  console.log(d.id ? 'Email sent (id: ' + d.id + ')' : 'Email failed: ' + JSON.stringify(d));
}).catch(e => console.error('Email send failed:', e.message));
