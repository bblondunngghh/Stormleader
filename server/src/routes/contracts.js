import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as contractService from '../services/contractService.js';

const router = Router();

// ============================================================
// PUBLIC routes (no auth — customer-facing)
// ============================================================

router.get('/public/:token', async (req, res, next) => {
  try {
    const contract = await contractService.getContractByToken(req.params.token);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    // Mark as viewed (side effect)
    await contractService.markViewed(req.params.token);
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/sign', async (req, res, next) => {
  try {
    const { signerName, signatureData } = req.body;
    if (!signerName) return res.status(400).json({ error: 'signerName is required' });
    const contract = await contractService.signContract(req.params.token, { signerName, signatureData });
    if (!contract) return res.status(404).json({ error: 'Contract not found or already signed' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATED routes
// ============================================================

router.use(authenticate);
router.use(tenantScope);

// ── Template routes (BEFORE /:id to avoid "templates" matching as id) ──

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await contractService.listTemplates(req.tenantId);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', async (req, res, next) => {
  try {
    const { name, type, content } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const template = await contractService.createTemplate(req.tenantId, { name, type, content });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.patch('/templates/:id', async (req, res, next) => {
  try {
    const template = await contractService.updateTemplate(req.tenantId, req.params.id, req.body);
    if (!template) return res.status(404).json({ error: 'Template not found or not editable' });
    res.json(template);
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', async (req, res, next) => {
  try {
    const deleted = await contractService.deleteTemplate(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Contract CRUD ──

router.get('/', async (req, res, next) => {
  try {
    const { status, lead_id, limit = '50', offset = '0' } = req.query;
    const result = await contractService.listContracts(req.tenantId, {
      status: status || undefined,
      leadId: lead_id || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contract = await contractService.getContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { leadId, estimateId, templateType, content } = req.body;
    const contract = await contractService.createContract(req.tenantId, { leadId, estimateId, templateType, content });
    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const contract = await contractService.updateContract(req.tenantId, req.params.id, req.body);
    if (!contract) return res.status(404).json({ error: 'Contract not found or not in draft status' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send', async (req, res, next) => {
  try {
    const contract = await contractService.sendContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found or not in draft status' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/void', async (req, res, next) => {
  try {
    const contract = await contractService.voidContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

export default router;
