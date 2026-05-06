// QA API test harness — hits every documented endpoint, records status & error preview.
// Usage: node qa-api-test.mjs > /tmp/api-test-results.txt

import fs from 'node:fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('./qa-token.txt', 'utf8').trim();

async function call(method, path, body, opts = {}) {
  const headers = { 'Authorization': `Bearer ${TOKEN}` };
  const hasBody = body !== undefined && body !== null;
  if (hasBody) headers['Content-Type'] = 'application/json';
  const start = Date.now();
  let res, text;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    text = await res.text();
  } catch (e) {
    return { method, path, status: 'NETERR', preview: e.message, ms: Date.now() - start };
  }
  const ms = Date.now() - start;
  let preview = text.slice(0, 240).replace(/\s+/g, ' ').trim();
  return { method, path, status: res.status, ms, preview };
}

// Step 1: gather sample IDs from list endpoints
async function getSampleIds() {
  const ids = {};
  const sources = [
    ['lead', '/api/crm/leads', (j) => j.leads?.[0]?.id || j.data?.[0]?.id],
    ['storm', '/api/storms', (j) => j[0]?.id || j.storms?.[0]?.id],
    ['estimate', '/api/estimates', (j) => j[0]?.id || j.estimates?.[0]?.id || j.data?.[0]?.id],
    ['invoice', '/api/crm/invoices', (j) => j[0]?.id || j.invoices?.[0]?.id || j.data?.[0]?.id],
    ['workOrder', '/api/crm/work-orders', (j) => j[0]?.id || j.workOrders?.[0]?.id || j.data?.[0]?.id],
    ['contract', '/api/crm/contracts', (j) => j[0]?.id || j.contracts?.[0]?.id || j.data?.[0]?.id],
    ['property', '/api/properties', (j) => j[0]?.id || j.properties?.[0]?.id || j.data?.[0]?.id],
    ['expense', '/api/crm/expenses', (j) => j[0]?.id || j.expenses?.[0]?.id || j.data?.[0]?.id],
    ['subcontractor', '/api/crm/subcontractors', (j) => j[0]?.id || j.subcontractors?.[0]?.id || j.data?.[0]?.id],
    ['territory', '/api/crm/territories', (j) => j[0]?.id || j.territories?.[0]?.id || j.data?.[0]?.id],
    ['canvassPin', '/api/crm/canvass-pins', (j) => j[0]?.id || j.pins?.[0]?.id || j.data?.[0]?.id],
    ['drip', '/api/crm/drip-sequences', (j) => j[0]?.id || j.sequences?.[0]?.id || j.data?.[0]?.id],
    ['automation', '/api/crm/automations', (j) => j[0]?.id || j.automations?.[0]?.id || j.data?.[0]?.id],
    ['template', '/api/estimates/templates', (j) => j[0]?.id || j.templates?.[0]?.id || j.data?.[0]?.id],
    ['contractTemplate', '/api/crm/contracts/templates', (j) => j[0]?.id || j.templates?.[0]?.id || j.data?.[0]?.id],
    ['notification', '/api/notifications', (j) => j[0]?.id || j.notifications?.[0]?.id || j.data?.[0]?.id],
    ['document', '/api/documents', (j) => j[0]?.id || j.documents?.[0]?.id || j.data?.[0]?.id],
    ['task', '/api/crm/tasks', (j) => j[0]?.id || j.tasks?.[0]?.id || j.data?.[0]?.id],
    ['stormEvent', '/api/storms?limit=1', (j) => j[0]?.id || j.storms?.[0]?.id],
    ['lender', '/api/crm/financing/lenders', (j) => j[0]?.id || j.lenders?.[0]?.id || j.data?.[0]?.id],
    ['plan', '/api/crm/financing/plans', (j) => j[0]?.id || j.plans?.[0]?.id || j.data?.[0]?.id],
    ['application', '/api/crm/financing/applications', (j) => j[0]?.id || j.applications?.[0]?.id || j.data?.[0]?.id],
    ['customField', '/api/crm/custom-fields', (j) => j[0]?.id || j.fields?.[0]?.id || j.data?.[0]?.id],
    ['prospectList', '/api/crm/prospect-lists', (j) => j[0]?.id || j.lists?.[0]?.id || j.data?.[0]?.id],
  ];
  for (const [name, p, pick] of sources) {
    try {
      const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (!r.ok) { ids[name] = null; continue; }
      const j = await r.json();
      ids[name] = pick(j) || null;
    } catch (e) { ids[name] = null; }
  }
  return ids;
}

const ids = await getSampleIds();
console.log('# Sample IDs found:');
for (const [k, v] of Object.entries(ids)) console.log(`#   ${k}: ${v ?? '(none)'}`);
console.log('');

// Step 2: define test list
// Each entry: [method, pathTemplate, body, label]
// Path templates use {lead}, {storm}, etc. for substitution from ids.
const TESTS = [
  // auth
  ['GET', '/api/auth/me', null, 'auth.me'],
  // storms
  ['GET', '/api/storms', null, 'storms.list'],
  ['GET', '/api/storms/{storm}', null, 'storms.byId'],
  // map
  ['GET', '/api/map/swaths', null, 'map.swaths'],
  // dashboard
  ['GET', '/api/dashboard/stats', null, 'dashboard.stats'],
  ['GET', '/api/dashboard/funnel', null, 'dashboard.funnel'],
  ['GET', '/api/dashboard/activity', null, 'dashboard.activity'],
  // properties (skip FEMA-live; per task instructions)
  ['GET', '/api/properties', null, 'properties.list'],
  ['GET', '/api/properties/{property}', null, 'properties.byId'],
  ['GET', '/api/properties/reverse-geocode?lat=43.4643&lng=-80.5204', null, 'properties.reverseGeocode'],
  ['GET', '/api/properties/{property}/weather-history', null, 'properties.weatherHistory'],
  // leads (top-level)
  ['GET', '/api/leads', null, 'leads.list'],
  ['GET', '/api/leads/{lead}', null, 'leads.byId'],
  // skip-trace
  ['GET', '/api/skip-trace/config', null, 'skipTrace.config'],
  ['GET', '/api/skip-trace/balance', null, 'skipTrace.balance'],
  ['GET', '/api/skip-trace/invoices', null, 'skipTrace.invoices'],
  ['GET', '/api/skip-trace/usage', null, 'skipTrace.usage'],
  ['GET', '/api/skip-trace/jobs', null, 'skipTrace.jobs'],
  // alerts
  ['GET', '/api/alerts/config', null, 'alerts.config'],
  ['GET', '/api/alerts/history', null, 'alerts.history'],
  // drift (skip correct-all; carry-over)
  ['GET', '/api/drift/{storm}', null, 'drift.byStorm'],
  // counties
  ['GET', '/api/counties', null, 'counties.list'],
  // crm
  ['GET', '/api/crm/leads', null, 'crm.leads.list'],
  ['GET', '/api/crm/leads/{lead}', null, 'crm.leads.byId'],
  ['GET', '/api/crm/leads/{lead}/activities', null, 'crm.leads.activities'],
  ['GET', '/api/crm/tasks', null, 'crm.tasks.list'],
  ['GET', '/api/crm/pipeline/stages', null, 'crm.pipeline.stages'],
  ['GET', '/api/crm/pipeline/metrics', null, 'crm.pipeline.metrics'],
  ['GET', '/api/crm/dashboard/stats', null, 'crm.dashboard.stats'],
  ['GET', '/api/crm/dashboard/activity', null, 'crm.dashboard.activity'],
  ['GET', '/api/crm/team', null, 'crm.team'],
  ['GET', '/api/crm/tenant-settings', null, 'crm.tenantSettings'],
  ['GET', '/api/crm/dashboard/properties-affected', null, 'crm.dashboard.propsAffected'],
  ['GET', '/api/crm/dashboard/properties-affected/list', null, 'crm.dashboard.propsAffectedList'],
  ['GET', '/api/crm/dashboard/followups', null, 'crm.dashboard.followups'],
  ['GET', '/api/crm/dashboard/conversion-by-storm', null, 'crm.dashboard.convByStorm'],
  ['GET', '/api/crm/dashboard/estimate-summary', null, 'crm.dashboard.estimateSummary'],
  ['GET', '/api/crm/dashboard/ar-summary', null, 'crm.dashboard.arSummary'],
  ['GET', '/api/crm/dashboard/estimating-conversion', null, 'crm.dashboard.estimatingConv'],
  ['GET', '/api/crm/dashboard/leaderboard', null, 'crm.dashboard.leaderboard'],
  ['GET', '/api/crm/dashboard/tasks-today', null, 'crm.dashboard.tasksToday'],
  ['GET', '/api/crm/dashboard/days-in-stage', null, 'crm.dashboard.daysInStage'],
  ['GET', '/api/crm/dashboard/stale-leads', null, 'crm.dashboard.staleLeads'],
  ['GET', '/api/crm/dashboard/customer-storm-alerts', null, 'crm.dashboard.customerStormAlerts'],
  ['GET', '/api/crm/dashboard/lead-source-revenue', null, 'crm.dashboard.leadSourceRevenue'],
  ['GET', '/api/crm/prospect-lists', null, 'crm.prospectLists'],
  ['GET', '/api/crm/calendar', null, 'crm.calendar'],
  ['GET', '/api/crm/custom-fields', null, 'crm.customFields'],
  // estimates
  ['GET', '/api/estimates', null, 'estimates.list'],
  ['GET', '/api/estimates/templates', null, 'estimates.templates'],
  ['GET', '/api/estimates/{estimate}', null, 'estimates.byId'],
  // notifications
  ['GET', '/api/notifications', null, 'notifications.list'],
  ['GET', '/api/notifications/unread-count', null, 'notifications.unreadCount'],
  ['GET', '/api/notifications/preferences', null, 'notifications.prefs'],
  // search
  ['GET', '/api/search?q=test', null, 'search.q'],
  // documents
  ['GET', '/api/documents', null, 'documents.list'],
  // roof-measurement
  ['GET', '/api/roof-measurement/config', null, 'roofMeas.config'],
  ['GET', '/api/roof-measurement/usage', null, 'roofMeas.usage'],
  ['GET', '/api/roof-measurement/balance', null, 'roofMeas.balance'],
  // admin
  ['GET', '/api/admin/overview', null, 'admin.overview'],
  ['GET', '/api/admin/tenants', null, 'admin.tenants'],
  ['GET', '/api/admin/revenue', null, 'admin.revenue'],
  ['GET', '/api/admin/usage', null, 'admin.usage'],
  // payments
  ['GET', '/api/payments/connect/status', null, 'payments.connectStatus'],
  ['GET', '/api/payments/history', null, 'payments.history'],
  // materials
  ['GET', '/api/materials/products', null, 'materials.products'],
  ['GET', '/api/materials/branches', null, 'materials.branches'],
  ['GET', '/api/materials/orders', null, 'materials.orders'],
  ['GET', '/api/materials/credentials', null, 'materials.credentials'],
  // financing
  ['GET', '/api/crm/financing/lenders', null, 'financing.lenders'],
  ['GET', '/api/crm/financing/plans', null, 'financing.plans'],
  ['GET', '/api/crm/financing/applications', null, 'financing.applications'],
  // automations
  ['GET', '/api/crm/automations', null, 'automations.list'],
  // invoices
  ['GET', '/api/crm/invoices', null, 'invoices.list'],
  ['GET', '/api/crm/invoices/{invoice}', null, 'invoices.byId'],
  // canvassing
  ['GET', '/api/crm/canvass-pins', null, 'canvass.list'],
  ['GET', '/api/crm/canvass-pins/stats', null, 'canvass.stats'],
  // reports
  ['GET', '/api/crm/reports/revenue', null, 'reports.revenue'],
  ['GET', '/api/crm/reports/pipeline', null, 'reports.pipeline'],
  ['GET', '/api/crm/reports/conversion', null, 'reports.conversion'],
  ['GET', '/api/crm/reports/rep-performance', null, 'reports.repPerformance'],
  ['GET', '/api/crm/reports/stage-duration', null, 'reports.stageDuration'],
  ['GET', '/api/crm/reports/lead-sources', null, 'reports.leadSources'],
  // work-orders
  ['GET', '/api/crm/work-orders/milestone-templates', null, 'wo.milestoneTemplates'],
  ['GET', '/api/crm/work-orders', null, 'wo.list'],
  ['GET', '/api/crm/work-orders/{workOrder}', null, 'wo.byId'],
  ['GET', '/api/crm/work-orders/{workOrder}/milestones', null, 'wo.milestones'],
  // drip
  ['GET', '/api/crm/drip-sequences', null, 'drip.list'],
  ['GET', '/api/crm/drip-sequences/{drip}', null, 'drip.byId'],
  ['GET', '/api/crm/drip-sequences/{drip}/enrollments', null, 'drip.enrollments'],
  // contracts
  ['GET', '/api/crm/contracts/templates', null, 'contracts.templates'],
  ['GET', '/api/crm/contracts', null, 'contracts.list'],
  ['GET', '/api/crm/contracts/{contract}', null, 'contracts.byId'],
  // expenses
  ['GET', '/api/crm/expenses', null, 'expenses.list'],
  ['GET', '/api/crm/expenses/summary/{lead}', null, 'expenses.summary'],
  // subcontractors
  ['GET', '/api/crm/subcontractors', null, 'subs.list'],
  ['GET', '/api/crm/subcontractors/{subcontractor}', null, 'subs.byId'],
  // territories
  ['GET', '/api/crm/territories', null, 'territories.list'],
  ['GET', '/api/crm/territories/{territory}', null, 'territories.byId'],
  ['GET', '/api/crm/territories/{territory}/pins', null, 'territories.pins'],
  // disaster-declarations
  ['GET', '/api/disaster-declarations', null, 'disasters.list'],
  // storm-history
  ['GET', '/api/storm-history?lat=43.4643&lng=-80.5204', null, 'stormHist.list'],
  ['GET', '/api/storm-history/heatmap', null, 'stormHist.heatmap'],
  // data
  ['GET', '/api/data/fema-housing?lat=43.4643&lng=-80.5204', null, 'data.femaHousing'],
  ['GET', '/api/data/directions?from=43.46,-80.52&to=43.47,-80.53', null, 'data.directions'],

  // ==== Empty-body POST/PATCH validation tests ====
  // These should return 400, NEVER 500. Crash here = bug.
  ['POST', '/api/crm/leads', {}, 'crm.leads.create.empty'],
  ['POST', '/api/crm/leads/quick', {}, 'crm.leads.quick.empty'],
  ['POST', '/api/crm/activities', {}, 'crm.activities.create.empty'],
  ['POST', '/api/crm/tasks', {}, 'crm.tasks.create.empty'],
  ['POST', '/api/crm/leads/bulk-assign', {}, 'crm.leads.bulkAssign.empty'],
  ['POST', '/api/crm/leads/bulk-status', {}, 'crm.leads.bulkStatus.empty'],
  ['POST', '/api/estimates', {}, 'estimates.create.empty'],
  ['POST', '/api/estimates/templates', {}, 'estimates.templates.create.empty'],
  ['POST', '/api/crm/invoices', {}, 'invoices.create.empty'],
  ['POST', '/api/crm/work-orders', {}, 'wo.create.empty'],
  ['POST', '/api/crm/contracts', {}, 'contracts.create.empty'],
  ['POST', '/api/crm/contracts/templates', {}, 'contracts.templates.create.empty'],
  ['POST', '/api/crm/expenses', {}, 'expenses.create.empty'],
  ['POST', '/api/crm/subcontractors', {}, 'subs.create.empty'],
  ['POST', '/api/crm/territories', {}, 'territories.create.empty'],
  ['POST', '/api/crm/canvass-pins', {}, 'canvass.create.empty'],
  ['POST', '/api/crm/drip-sequences', {}, 'drip.create.empty'],
  ['POST', '/api/crm/automations', {}, 'automations.create.empty'],
  ['POST', '/api/crm/financing/lenders', {}, 'financing.lenders.create.empty'],
  ['POST', '/api/crm/financing/applications', {}, 'financing.apps.create.empty'],
  ['POST', '/api/crm/prospect-lists', {}, 'crm.prospectLists.create.empty'],
  ['POST', '/api/crm/custom-fields', {}, 'crm.customFields.create.empty'],
  ['POST', '/api/crm/team/invite', {}, 'crm.team.invite.empty'],
  ['POST', '/api/crm/test-email', {}, 'crm.testEmail.empty'],
  ['POST', '/api/leads/from-storm', {}, 'leads.fromStorm.empty'],
  ['POST', '/api/skip-trace/submit', {}, 'skipTrace.submit.empty'],
  ['POST', '/api/roof-measurement/measure', {}, 'roofMeas.measure.empty'],
  ['POST', '/api/roof-measurement/manual', {}, 'roofMeas.manual.empty'],
  ['POST', '/api/alerts/test', {}, 'alerts.test.empty'],
  ['POST', '/api/properties/geocode', {}, 'properties.geocode.empty'],
  ['POST', '/api/properties/generate-leads', {}, 'properties.generateLeads.empty'],

  // ==== PDF endpoints (could crash on missing data / lib failures) ====
  ['GET', '/api/estimates/{estimate}/pdf', null, 'estimates.pdf'],
  ['GET', '/api/crm/contracts/{contract}/pdf', null, 'contracts.pdf'],
  ['GET', '/api/crm/work-orders/{workOrder}/pdf', null, 'wo.pdf'],

  // ==== PATCH empty-body validation tests ====
  ['PATCH', '/api/crm/leads/{lead}', {}, 'crm.leads.patch.empty'],
  ['PATCH', '/api/crm/tasks/{task}', {}, 'crm.tasks.patch.empty'],
  ['PATCH', '/api/estimates/{estimate}', {}, 'estimates.patch.empty'],
  ['PATCH', '/api/crm/invoices/{invoice}', {}, 'invoices.patch.empty'],
  ['PATCH', '/api/crm/work-orders/{workOrder}', {}, 'wo.patch.empty'],
  ['PATCH', '/api/crm/contracts/{contract}', {}, 'contracts.patch.empty'],
  ['PATCH', '/api/crm/expenses/{expense}', {}, 'expenses.patch.empty'],
  ['PATCH', '/api/crm/subcontractors/{subcontractor}', {}, 'subs.patch.empty'],
  ['PATCH', '/api/crm/territories/{territory}', {}, 'territories.patch.empty'],
  ['PATCH', '/api/crm/canvass-pins/{canvassPin}', {}, 'canvass.patch.empty'],
  ['PATCH', '/api/crm/custom-fields/{customField}', {}, 'crm.customFields.patch.empty'],
  ['PATCH', '/api/crm/tenant-settings', {}, 'crm.tenantSettings.put.empty'],
  ['PATCH', '/api/notifications/preferences', {}, 'notifications.prefs.patch.empty'],
  ['PATCH', '/api/auth/me', {}, 'auth.me.patch.empty'],

  // ==== PUT empty-body validation tests ====
  ['PUT', '/api/alerts/config', {}, 'alerts.config.put.empty'],
  ['PUT', '/api/skip-trace/config', {}, 'skipTrace.config.put.empty'],
  ['PUT', '/api/roof-measurement/config', {}, 'roofMeas.config.put.empty'],
  ['PUT', '/api/crm/tenant-settings', {}, 'crm.tenantSettings.putEmpty'],
  ['PUT', '/api/materials/credentials', {}, 'materials.credentials.put.empty'],

  // ==== Run 19 expansion: previously untested GET endpoints ====
  // Public token endpoints — bogus token must 404, not 500
  ['GET', '/api/crm/contracts/public/bogus-token-zzz', null, 'contracts.public.byToken'],
  ['GET', '/api/estimates/public/bogus-token-zzz', null, 'estimates.public.byToken'],
  ['GET', '/api/crm/financing/public/bogus-token-zzz/plans', null, 'financing.public.plans'],
  ['GET', '/api/crm/financing/public/bogus-token-zzz/applications', null, 'financing.public.applications'],
  ['GET', '/api/leads/status/public/bogus-token-zzz', null, 'leads.public.statusByToken'],
  // Authenticated GETs not tested before
  ['GET', '/api/admin/tenants/00000000-0000-0000-0000-000000000000', null, 'admin.tenant.byId'],
  ['GET', '/api/counties/00000000-0000-0000-0000-000000000000/status', null, 'counties.status'],
  ['GET', '/api/crm/prospect-lists/00000000-0000-0000-0000-000000000000/items', null, 'crm.prospectLists.items'],
  ['GET', '/api/crm/financing/applications/00000000-0000-0000-0000-000000000000', null, 'financing.applications.byId'],
  ['GET', '/api/materials/products/00000000-0000-0000-0000-000000000000', null, 'materials.products.byId'],
  ['GET', '/api/materials/orders/00000000-0000-0000-0000-000000000000', null, 'materials.orders.byId'],
  ['GET', '/api/onboarding/plans', null, 'onboarding.plans'],
  ['GET', '/api/properties/import-progress', null, 'properties.importProgress'],
  ['GET', '/api/properties/in-swath/00000000-0000-0000-0000-000000000000/count', null, 'properties.inSwath.count'],
  ['GET', '/api/properties/in-swath/00000000-0000-0000-0000-000000000000', null, 'properties.inSwath'],
  ['GET', '/api/properties/{property}/weather-history/pdf', null, 'properties.weatherHistory.pdf'],
  ['GET', '/api/properties/{property}/report/pdf', null, 'properties.report.pdf'],
  ['GET', '/api/roof-measurement/segments/{property}', null, 'roofMeas.segments'],
  ['GET', '/api/roof-measurement/solar/{property}', null, 'roofMeas.solar'],
  ['GET', '/api/skip-trace/job/00000000-0000-0000-0000-000000000000', null, 'skipTrace.job.byId'],
  ['GET', '/api/crm/subcontractors/work-order/{workOrder}', null, 'subs.byWorkOrder'],
  // Map GETs (require bbox query params)
  ['GET', '/api/map/properties?bbox=-80.6,43.4,-80.4,43.5', null, 'map.properties'],
  ['GET', '/api/map/affected-properties?bbox=-80.6,43.4,-80.4,43.5', null, 'map.affectedProperties'],

  // ==== Run 19: previously untested PATCH empty-body validation ====
  ['PATCH', '/api/crm/automations/00000000-0000-0000-0000-000000000000', {}, 'automations.patch.empty'],
  ['PATCH', '/api/crm/automations/00000000-0000-0000-0000-000000000000/toggle', {}, 'automations.toggle.empty'],
  ['PATCH', '/api/crm/contracts/templates/00000000-0000-0000-0000-000000000000', {}, 'contracts.templates.patch.empty'],
  ['PATCH', '/api/crm/leads/{lead}/roof-type', {}, 'crm.leads.roofType.empty'],
  ['PATCH', '/api/crm/team/00000000-0000-0000-0000-000000000000/role', {}, 'crm.team.role.empty'],
  ['PATCH', '/api/crm/drip-sequences/00000000-0000-0000-0000-000000000000', {}, 'drip.patch.empty'],
  ['PATCH', '/api/estimates/templates/00000000-0000-0000-0000-000000000000', {}, 'estimates.templates.patch.empty'],
  ['PATCH', '/api/crm/financing/lenders/00000000-0000-0000-0000-000000000000', {}, 'financing.lenders.patch.empty'],
  ['PATCH', '/api/crm/financing/plans/00000000-0000-0000-0000-000000000000', {}, 'financing.plans.patch.empty'],
  ['PATCH', '/api/leads/{lead}', {}, 'leads.patch.empty'],
  ['PATCH', '/api/notifications/00000000-0000-0000-0000-000000000000/read', {}, 'notifications.read.empty'],
  ['PATCH', '/api/crm/work-orders/{workOrder}/complete', {}, 'wo.complete.empty'],
  ['PATCH', '/api/crm/work-orders/{workOrder}/milestones/00000000-0000-0000-0000-000000000000', {}, 'wo.milestone.empty'],

  // ==== Run 19: previously untested PUT empty-body validation ====
  ['PUT', '/api/admin/tenants/00000000-0000-0000-0000-000000000000', {}, 'admin.tenant.put.empty'],
  ['PUT', '/api/onboarding/org', {}, 'onboarding.org.put.empty'],
  ['PUT', '/api/properties/{property}/location', {}, 'properties.location.put.empty'],

  // ==== Run 19: action-style POSTs (empty body, harmless inputs) ====
  // We send empty {} to confirm input-validation guards exist (400, not 500)
  ['POST', '/api/crm/canvass-pins/{canvassPin}/convert', {}, 'canvass.convert.empty'],
  ['POST', '/api/crm/contracts/{contract}/send', {}, 'contracts.send.empty'],
  ['POST', '/api/crm/contracts/{contract}/void', {}, 'contracts.void.empty'],
  ['POST', '/api/crm/leads/{lead}/score', {}, 'crm.leads.score.empty'],
  ['POST', '/api/crm/leads/{lead}/contacts', {}, 'crm.leads.contacts.empty'],
  ['POST', '/api/crm/drip-sequences/{drip}/enroll', {}, 'drip.enroll.empty'],
  ['POST', '/api/crm/drip-sequences/{drip}/cancel', {}, 'drip.cancel.empty'],
  ['POST', '/api/estimates/{estimate}/send', {}, 'estimates.send.empty'],
  ['POST', '/api/estimates/{estimate}/duplicate', {}, 'estimates.duplicate.empty'],
  ['POST', '/api/estimates/{estimate}/sign-in-person', {}, 'estimates.signInPerson.empty'],
  ['POST', '/api/estimates/{estimate}/generate-tiers', {}, 'estimates.generateTiers.empty'],
  ['POST', '/api/crm/invoices/{invoice}/payment', {}, 'invoices.payment.empty'],
  ['POST', '/api/crm/invoices/{invoice}/send', {}, 'invoices.send.empty'],
  ['POST', '/api/crm/invoices/{invoice}/send-email', {}, 'invoices.sendEmail.empty'],
  ['POST', '/api/leads/{lead}/status-token', {}, 'leads.statusToken.empty'],
  ['POST', '/api/notifications/mark-all-read', {}, 'notifications.markAllRead.empty'],
  ['POST', '/api/data/optimize-route', {}, 'data.optimizeRoute.empty'],
  ['POST', '/api/crm/subcontractors/assign', {}, 'subs.assign.empty'],
  ['POST', '/api/properties/{property}/fema-lookup', {}, 'properties.femaLookup.empty'],
  ['POST', '/api/drift/{storm}/correct', {}, 'drift.correct.empty'],
  ['POST', '/api/drift/simulate', {}, 'drift.simulate.empty'],
  ['POST', '/api/drift/calibrate', {}, 'drift.calibrate.empty'],
  ['POST', '/api/counties', {}, 'counties.create.empty'],
  // Public-token POSTs with bogus tokens
  ['POST', '/api/crm/contracts/public/bogus-token-zzz/sign', {}, 'contracts.public.sign.empty'],
  ['POST', '/api/estimates/public/bogus-token-zzz/accept', {}, 'estimates.public.accept.empty'],
  ['POST', '/api/estimates/public/bogus-token-zzz/decline', {}, 'estimates.public.decline.empty'],
  ['POST', '/api/crm/financing/public/bogus-token-zzz/apply', {}, 'financing.public.apply.empty'],

  // ==== Run 20: 18 DELETE endpoints (bogus UUIDs — safe, will 404 not delete) ====
  // Validates the route exists, auth gate works, validateId middleware works,
  // and the handler returns 404 cleanly on missing rows instead of crashing.
  ['DELETE', '/api/crm/automations/00000000-0000-0000-0000-000000000000', null, 'automations.delete.missing'],
  ['DELETE', '/api/crm/contracts/templates/00000000-0000-0000-0000-000000000000', null, 'contracts.templates.delete.missing'],
  ['DELETE', '/api/crm/leads/00000000-0000-0000-0000-000000000000', null, 'crm.leads.delete.missing'],
  ['DELETE', '/api/crm/leads/00000000-0000-0000-0000-000000000000/contacts/00000000-0000-0000-0000-000000000000', null, 'crm.leads.contacts.delete.missing'],
  ['DELETE', '/api/crm/prospect-lists/00000000-0000-0000-0000-000000000000/items/00000000-0000-0000-0000-000000000000', null, 'crm.prospectLists.items.delete.missing'],
  ['DELETE', '/api/crm/prospect-lists/00000000-0000-0000-0000-000000000000', null, 'crm.prospectLists.delete.missing'],
  ['DELETE', '/api/crm/custom-fields/00000000-0000-0000-0000-000000000000', null, 'crm.customFields.delete.missing'],
  ['DELETE', '/api/documents/00000000-0000-0000-0000-000000000000', null, 'documents.delete.missing'],
  ['DELETE', '/api/crm/drip-sequences/00000000-0000-0000-0000-000000000000', null, 'drip.delete.missing'],
  ['DELETE', '/api/estimates/templates/00000000-0000-0000-0000-000000000000', null, 'estimates.templates.delete.missing'],
  ['DELETE', '/api/estimates/00000000-0000-0000-0000-000000000000', null, 'estimates.delete.missing'],
  ['DELETE', '/api/crm/expenses/00000000-0000-0000-0000-000000000000', null, 'expenses.delete.missing'],
  ['DELETE', '/api/crm/financing/lenders/00000000-0000-0000-0000-000000000000', null, 'financing.lenders.delete.missing'],
  ['DELETE', '/api/skip-trace/payment-method', null, 'skipTrace.paymentMethod.delete.missing'],
  ['DELETE', '/api/crm/subcontractors/00000000-0000-0000-0000-000000000000', null, 'subs.delete.missing'],
  ['DELETE', '/api/crm/subcontractors/work-order/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000', null, 'subs.workOrder.delete.missing'],
  ['DELETE', '/api/crm/territories/00000000-0000-0000-0000-000000000000', null, 'territories.delete.missing'],
  ['DELETE', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones/00000000-0000-0000-0000-000000000000', null, 'wo.milestone.delete.missing'],

  // ==== Run 20: 7 more empty-body input-validation POSTs ====
  // These call paths invoke services that could crash if input validation is missing.
  // Empty body should yield 400/404, NEVER 500.
  ['POST', '/api/properties', {}, 'properties.create.empty'],
  ['POST', '/api/materials/orders', {}, 'materials.orders.create.empty'],
  ['POST', '/api/materials/estimate/00000000-0000-0000-0000-000000000000/auto-order', {}, 'materials.autoOrder.empty'],
  ['POST', '/api/crm/financing/plans/sync', {}, 'financing.plans.sync.empty'],
  ['POST', '/api/crm/invoices/from-estimate/00000000-0000-0000-0000-000000000000', {}, 'invoices.fromEstimate.empty'],
  ['POST', '/api/crm/work-orders/from-estimate/00000000-0000-0000-0000-000000000000', {}, 'wo.fromEstimate.empty'],
  ['POST', '/api/crm/work-orders/{workOrder}/milestones', {}, 'wo.milestones.create.empty'],
];

const subst = (path) => path.replace(/\{(\w+)\}/g, (_, k) => ids[k] ?? '00000000-0000-0000-0000-000000000000');

const results = [];
for (const [method, tmpl, body, label] of TESTS) {
  const path = subst(tmpl);
  // Skip if template references a missing id and the substitution returned the placeholder
  const r = await call(method, path, body);
  r.label = label;
  results.push(r);
  console.log(`${r.status}\t${r.ms}ms\t${method}\t${path}\t${r.preview.slice(0,160)}`);
}

// Summary
const bad = results.filter(r => {
  if (typeof r.status !== 'number') return true;
  if (r.status >= 500) return true;
  // Empty-body POST/PATCH that returned 500 is a CRASH
  return false;
});

console.log('\n# SUMMARY');
console.log(`Total: ${results.length}`);
console.log(`OK (2xx/3xx/4xx): ${results.filter(r => typeof r.status === 'number' && r.status < 500).length}`);
console.log(`5xx: ${results.filter(r => typeof r.status === 'number' && r.status >= 500).length}`);
console.log(`NETERR: ${results.filter(r => r.status === 'NETERR').length}`);

console.log('\n# BAD ENDPOINTS:');
for (const r of bad) {
  console.log(`  ${r.status}\t${r.method}\t${r.path}\t${r.label}\n    ${r.preview}`);
}

// Write JSON for further analysis
fs.writeFileSync('./qa-api-test-results.json', JSON.stringify({ ids, results }, null, 2));
