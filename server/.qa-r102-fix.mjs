// Run 102 fix: remove the redundant .glass copy-paste (with its !important)
// from .map-controls__dropdown-trigger. All-or-nothing: aborts without writing
// if the pattern does not match exactly once. Preserves the file's own EOL.
import fs from 'fs';

const F = 'client/src/index.css';
const raw = fs.readFileSync(F, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';

// The element is <button className="map-controls__dropdown-trigger glass">, so
// .glass (index.css:113) ALREADY supplies these four declarations verbatim.
// The duplicated pair carried !important, which beat both the rule's own later
// component-specific values AND the entire :hover rule below it.
const DEAD = [
  '  background: var(--glass-bg) !important;',
  '  backdrop-filter: blur(16px) saturate(1.3);',
  '  -webkit-backdrop-filter: blur(16px) saturate(1.3);',
  '  border: 1px solid var(--glass-border) !important;',
].join(EOL) + EOL;

const n = raw.split(DEAD).length - 1;
if (n !== 1) {
  console.error(`ABORT: pattern matched ${n} times, expected exactly 1. Nothing written.`);
  process.exit(1);
}
fs.writeFileSync(F, raw.replace(DEAD, ''), 'utf8');
console.log(`OK: removed 4 redundant declarations from .map-controls__dropdown-trigger (EOL=${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
