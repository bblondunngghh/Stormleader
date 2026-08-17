// Run 78 s2 — SET DIFFERENCE: field names the JSX reads off an API row object
// vs the keys the API actually returns for that row.
//
// Motivation: Run 77-s3 exhausted the CSS/className/var() name kinds and explicitly
// nominated "DB column names selected in SQL vs field names read in JSX" as untried.
// A field the UI reads but the API never returns renders as blank/undefined SILENTLY —
// no console error, no failed request, so every output-inspection sweep passes it.
//
// The API key sets below were captured LIVE from the running server (not from SQL),
// so they already reflect aliases added in JS and JOINed columns.
import fs from 'fs';

const API_KEYS = {
  leads: ['id','tenant_id','stage','priority','estimated_value','actual_value','source','tags','address','city','hail_size_in','insurance_company','contact_name','contact_phone','contact_email','last_contact_at','next_follow_up','notes','lost_reason','created_at','updated_at','deleted_at','property_id','storm_event_id','assigned_rep_id','custom_fields','lead_score','lead_score_factors','lead_score_updated_at','contact_first_name','contact_last_name','primary_phone','primary_email','rep_first_name','rep_last_name','rep_email','roof_type','roof_sqft','year_built','assessed_value','financing_status','task_total','task_done'],
  estimates: ['id','tenant_id','lead_id','created_by','estimate_number','status','customer_name','customer_address','customer_phone','customer_email','line_items','subtotal','tax_rate','tax_amount','discount_type','discount_value','total','scope_of_work','terms','warranty_info','notes','valid_until','public_token','signature_data','signed_at','signer_name','sent_at','viewed_at','created_at','updated_at','financing_enabled','financing_plan_ids','insurance_details','upgrades','creator_first_name','creator_last_name','lead_name','lead_address'],
  workOrders: ['id','tenant_id','lead_id','estimate_id','title','description','status','assigned_to','crew_name','scheduled_date','scheduled_time_start','scheduled_time_end','completed_at','line_items','notes','created_at','updated_at','contact_name','address','assigned_name'],
  tasks: ['id','tenant_id','lead_id','assigned_to','title','description','due_date','completed_at','priority','created_at','updated_at','status','created_by','assignee_first_name','assignee_last_name'],
};

// component file -> [row-variable names to scan, API key set]
const TARGETS = [
  ['client/src/components/LeadList.jsx',      ['lead','l','row'],            'leads'],
  ['client/src/components/Pipeline.jsx',      ['lead','l','card'],           'leads'],
  ['client/src/components/EstimatesView.jsx', ['est','estimate','e'],        'estimates'],
  ['client/src/components/WorkOrdersView.jsx',['wo','workOrder','w','order'],'workOrders'],
  ['client/src/components/TasksView.jsx',     ['task','t'],                  'tasks'],
];

const ROOT = 'C:/Projects/stormleads/';
const report = [];

for (const [file, vars, keySet] of TARGETS) {
  let src;
  try { src = fs.readFileSync(ROOT + file, 'utf8'); }
  catch { report.push({ file, error: 'NOT FOUND' }); continue; }
  const lines = src.split('\n');
  const known = new Set(API_KEYS[keySet]);
  const hits = new Map(); // field -> [{line, snippet}]

  for (const v of vars) {
    // match `v.field` but not `v.field(` (method call) and not `this.`
    const re = new RegExp(`(?<![\\w$.])${v}\\.([a-z_][a-zA-Z0-9_]*)`, 'g');
    lines.forEach((ln, i) => {
      let m;
      while ((m = re.exec(ln)) !== null) {
        const field = m[1];
        // skip JS built-ins / array+string methods and obvious non-data props
        if (/^(map|filter|find|length|toFixed|toString|slice|split|join|includes|forEach|reduce|some|every|indexOf|replace|trim|push|sort|concat|charAt|match|test|then|catch|target|value|current|preventDefault|stopPropagation|nativeEvent|currentTarget|key|props|state|toLocaleString|toLocaleDateString|padStart|repeat|startsWith|endsWith|substring|toUpperCase|toLowerCase|keys|values|entries|hasOwnProperty|call|apply|bind|constructor|prototype)$/.test(field)) continue;
        if (known.has(field)) continue;
        if (!hits.has(field)) hits.set(field, []);
        if (hits.get(field).length < 3) hits.get(field).push({ line: i + 1, snippet: ln.trim().slice(0, 110) });
      }
    });
  }
  report.push({ file, keySet, apiKeyCount: known.size, unmatched: [...hits.entries()].map(([f, occ]) => ({ field: f, count: occ.length, occ })) });
}

fs.writeFileSync('C:/tmp/r78s2-fielddiff.json', JSON.stringify(report, null, 1));
for (const r of report) {
  if (r.error) { console.log(`\n### ${r.file}: ${r.error}`); continue; }
  console.log(`\n### ${r.file}  (vs ${r.keySet}, ${r.apiKeyCount} api keys) -> ${r.unmatched.length} unmatched`);
  for (const u of r.unmatched) console.log(`  ${u.field.padEnd(26)} L${u.occ.map(o => o.line).join(',')}`);
}
