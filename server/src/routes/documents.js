import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as documentService from '../services/documentService.js';
import { parsePagination } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// Resolve uploads dir to a stable absolute path (independent of process CWD)
// and ensure it exists at startup so multer.diskStorage never fails with ENOENT.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure multer for local uploads (swap for S3 in production)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
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
      const err = new Error('File type not allowed');
      err.status = 400;
      cb(err);
    }
  },
});

// Multer wraps fileFilter rejections and size-limit errors so they surface as
// the route's normal error path. Translate them to 4xx instead of 500.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      // LIMIT_FILE_SIZE → 413; other multer errors (unexpected field, etc.) → 400
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message });
    }
    // fileFilter rejection: use status attached above
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  });
}

// GET /api/documents
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, type } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const result = await documentService.getDocuments(req.tenantId, {
      leadId: lead_id, type,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/upload
router.post('/upload', handleUpload, async (req, res, next) => {
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
router.delete('/:id', validateId(), async (req, res, next) => {
  try {
    const result = await documentService.deleteDocument(req.tenantId, req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
