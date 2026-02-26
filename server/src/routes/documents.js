import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as documentService from '../services/documentService.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// Configure multer for local uploads (swap for S3 in production)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv|txt/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

// GET /api/documents
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, type, limit, offset } = req.query;
    const result = await documentService.getDocuments(req.tenantId, {
      leadId: lead_id, type,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const doc = await documentService.createDocument(req.tenantId, req.user.id, {
      lead_id: req.body.lead_id,
      type: req.body.type || 'other',
      filename: req.file.originalname,
      file_url: `/uploads/${req.file.filename}`,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      description: req.body.description,
      tags: req.body.tags ? JSON.parse(req.body.tags) : null,
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await documentService.deleteDocument(req.tenantId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
