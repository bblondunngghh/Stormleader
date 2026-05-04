import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as expenseService from '../services/expenseService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List expenses
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, category, start_date, end_date, limit = '50', offset = '0' } = req.query;
    const result = await expenseService.listExpenses(req.tenantId, {
      leadId: lead_id || undefined,
      category: category || undefined,
      startDate: start_date || undefined,
      endDate: end_date || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Job cost summary
router.get('/summary/:leadId', validateId('leadId'), async (req, res, next) => {
  try {
    const summary = await expenseService.getJobCostSummary(req.tenantId, req.params.leadId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Create expense
router.post('/', async (req, res, next) => {
  try {
    const { lead_id, category, amount, date, notes } = req.body;
    if (!category || !amount || !date) {
      return res.status(400).json({ error: 'category, amount, and date are required' });
    }
    const expense = await expenseService.createExpense(req.tenantId, {
      leadId: lead_id,
      category,
      amount,
      date,
      notes,
      createdBy: req.userId,
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

// Update expense
router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const expense = await expenseService.updateExpense(req.tenantId, req.params.id, req.body);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
});

// Delete expense
router.delete('/:id', validateId(), async (req, res, next) => {
  try {
    const deleted = await expenseService.deleteExpense(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
