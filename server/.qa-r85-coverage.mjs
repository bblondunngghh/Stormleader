// Which param routes did the sweep exercise with a DEAD uuid? Those 404 before the
// handler runs, so they prove nothing (qa_standing_gotchas: "a dead-uuid sweep is
// structurally incapable of finding stored-shape crashes"). Group them by family so
// we know exactly which rows are worth creating.
import fs from 'fs';
const INV = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const GET = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-get-results.json', 'utf8'));

const dead = GET.filter(r => r.ids && r.ids.includes('DEAD'));
console.log('GET param routes run with at least one DEAD id:', dead.length);
const byFile = {};
for (const r of dead) (byFile[r.file] ||= []).push(`${r.path} [${r.ids}]`);
for (const [f, list] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length))
  console.log(`\n${f} (${list.length})\n  ` + list.join('\n  '));

console.log('\n\n=== ALL param routes in the inventory, by method ===');
const params = INV.filter(r => r.path.includes(':'));
const byM = {};
for (const r of params) byM[r.method] = (byM[r.method] || 0) + 1;
console.log(JSON.stringify(byM), 'of', INV.length, 'total');
