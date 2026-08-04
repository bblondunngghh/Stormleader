import fs from 'fs'; import zlib from 'zlib';
for (const f of process.argv.slice(2)) {
  const d = fs.readFileSync(f);
  let out = '';
  let i = 0;
  while (true) {
    const s = d.indexOf('stream', i); if (s === -1) break;
    let b = s + 6; if (d[b] === 13) b++; if (d[b] === 10) b++;
    const e = d.indexOf('endstream', b); if (e === -1) break;
    const chunk = d.subarray(b, e);
    try { out += zlib.inflateSync(chunk).toString('latin1'); } catch { out += chunk.toString('latin1'); }
    i = e + 9;
  }
  // pdfmake writes visible text inside (...) Tj / TJ operators
  const probes = ['Roof repair', 'QA shingle install', 'Description', 'Unit Price', 'General', 'Qty', 'ESTIMATE'];
  const hits = probes.filter(p => out.includes(p));
  console.log(`${f.split(/[\\/]/).pop()}  decompressed ${out.length} bytes`);
  console.log('    contains:', hits.join(', ') || '(none)');
}
