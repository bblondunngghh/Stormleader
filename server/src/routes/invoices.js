import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as invoiceService from '../services/invoiceService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List invoices
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const result = await invoiceService.getInvoices(req.tenantId, {
      status: status || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get single invoice
router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoice(req.tenantId, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Create invoice
router.post('/', async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.tenantId, req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// Create from estimate
router.post('/from-estimate/:estimateId', async (req, res, next) => {
  try {
    const invoice = await invoiceService.createFromEstimate(req.tenantId, req.params.estimateId);
    if (!invoice) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// Update invoice
router.patch('/:id', async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.tenantId, req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Record payment
router.post('/:id/payment', async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
    const invoice = await invoiceService.recordPayment(req.tenantId, req.params.id, amount);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Mark as sent
router.post('/:id/send', async (req, res, next) => {
  try {
    const invoice = await invoiceService.sendInvoice(req.tenantId, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

export default router;
