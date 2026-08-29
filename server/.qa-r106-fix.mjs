/**
 * Run 106 (s3 ui-audit) — FIX: take the FullCalendar override block OUT of
 * @layer base.
 *
 * index.css is wrapped in `@layer base { ... }` (line 6). FullCalendar v6
 * self-injects its stylesheet UNLAYERED, and an unlayered NORMAL declaration
 * beats every layered one regardless of specificity. So 27 declarations in the
 * app's FC override block were silently dead — measured, not inferred.
 *
 * The author already hit this once and patched `.fc-button-primary` typography
 * with !important (see the comment at the top of that rule). Extending that to
 * the remaining 27 would ALSO require bumping every `:hover` / `.fc-button-active`
 * / `.fc-button-group .fc-button` override that must keep beating them — adding
 * !important inverts the cascade and would kill those state rules. Closing the
 * layer around the block instead fixes all 27 at once and preserves every
 * intra-app precedence relationship exactly as written.
 *
 * All-or-nothing: writes nothing unless every anchor matches exactly once and
 * the extracted region is brace-balanced.
 */
import fs from 'fs';

const FILE = 'client/src/index.css';
const raw = fs.readFileSync(FILE, 'utf8');

// Run 98 rule: match this file's own EOL, do not reformat it.
const crlf = (raw.match(/\r\n/g) || []).length;
const lf = (raw.match(/(?<!\r)\n/g) || []).length;
const EOL = crlf > lf ? '\r\n' : '\n';
console.log(`EOL: ${EOL === '\r\n' ? 'CRLF' : 'LF'}  (crlf=${crlf} lf=${lf})`);

const START = `/* FullCalendar theme overrides — dark mode, oklch only */${EOL}.calendar-view .fc {`;
const END = `.calendar-view .fc .fc-list-event-title a {${EOL}  color: oklch(0.88 0 0);${EOL}}`;

const problems = [];
const nStart = raw.split(START).length - 1;
const nEnd = raw.split(END).length - 1;
if (nStart !== 1) problems.push(`START anchor matched ${nStart}x (want 1)`);
if (nEnd !== 1) problems.push(`END anchor matched ${nEnd}x (want 1)`);

if (!problems.length) {
  const i = raw.indexOf(START);
  const j = raw.indexOf(END) + END.length;
  if (j <= i) problems.push('END anchor precedes START anchor');
  else {
    const region = raw.slice(i, j);
    const bal = (region.match(/{/g) || []).length - (region.match(/}/g) || []).length;
    if (bal !== 0) problems.push(`extracted region brace-imbalanced by ${bal}`);
    if (!/@layer base \{/.test(raw)) problems.push('no `@layer base {` opener found');
    if (/@layer base \{/.test(region)) problems.push('region already contains a layer opener');
  }
}

if (problems.length) {
  console.error('ABORT — no write. Problems:');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

const i = raw.indexOf(START);
const j = raw.indexOf(END) + END.length;

const PRE = [
  `} /* end @layer base — the FullCalendar block below is deliberately UNLAYERED */`,
  ``,
  `/* FullCalendar v6 self-injects its stylesheet UNLAYERED, and an unlayered`,
  `   NORMAL declaration beats every layered one regardless of specificity. With`,
  `   this block inside @layer base, 27 of its declarations were silently dead —`,
  `   the toolbar title rendered at FC's 24.5px instead of 18px, the Today button`,
  `   lost its glass background and border, the day-of-week header cushions`,
  `   collapsed to FC's 2px padding, and the grid kept the outer borders this`,
  `   block removes. Keeping the block OUTSIDE the layer restores all of them`,
  `   without !important, which would otherwise have to be repeated on every`,
  `   :hover / .fc-button-active / .fc-button-group override below to stop those`,
  `   from going dead in turn. */`,
  ``,
].join(EOL);

const POST = `${EOL}${EOL}@layer base {`;

const next = raw.slice(0, i) + PRE + raw.slice(i, j) + POST + raw.slice(j);

// final guard: whole-file brace balance must be unchanged
const balBefore = (raw.match(/{/g) || []).length - (raw.match(/}/g) || []).length;
const balAfter = (next.match(/{/g) || []).length - (next.match(/}/g) || []).length;
if (balBefore !== balAfter) {
  console.error(`ABORT — brace balance changed ${balBefore} -> ${balAfter}`);
  process.exit(1);
}

fs.writeFileSync(FILE, next, 'utf8');
console.log('WROTE', FILE);
console.log('  layer closed before the FC block, reopened after it');
console.log('  whole-file brace balance:', balAfter, '(unchanged)');
