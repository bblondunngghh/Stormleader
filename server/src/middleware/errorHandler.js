import logger from '../utils/logger.js';

export default function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  logger.error({ err, method: req.method, url: req.url }, err.message);
  if (status === 500) process.stdout.write(`[500 DEBUG] ${req.method} ${req.url} ${err && err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : String(err)}\n`);

  res.status(status).json({ error: message });
}
