import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
app.use(express.json());

app.use('/api', routes);

// In production, serve the built React frontend
if (config.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

export default app;
