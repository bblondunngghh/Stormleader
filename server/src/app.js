import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import config from './config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const corsOrigin = config.NODE_ENV === 'production'
  ? true  // allow same-origin in production
  : 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
// Raw body parser for Hearth webhook (must be before JSON parser)
app.use('/api/webhooks/hearth', express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  // Skip JSON parsing for webhooks that need raw body for signature verification
  if (req.originalUrl === '/api/payments/webhook' || req.originalUrl === '/api/webhooks/hearth') {
    return next();
  }
  express.json()(req, res, (err) => {
    if (err) return next(err);
    // Guarantee req.body is always an object so handlers can safely destructure
    // even when clients omit Content-Type or send no body at all.
    if (req.body == null) req.body = {};
    next();
  });
});

app.use('/api', routes);

// In production, serve the built React frontend
if (config.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
