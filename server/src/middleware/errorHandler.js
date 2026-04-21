import fs from 'fs';
import logger from '../utils/logger.js';

export default function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  logger.error({ err, method: req.method, url: req.url }, err.message);
  if (status === 500) {
    try {
      fs.appendFileSync('api-500s.log', `[500] ${new Date().toISOString()} ${req.method} ${req.url}\n${err && err.stack ? err.stack : String(err)}\n\n`);
    } catch (_e) {
      console.error('[errorHandler fallback write failed]', _e.message);
    }
    console.error('[500]', req.method, req.url, err && err.message, err && err.code);
  }

  res.status(status).json({ error: message });
}
