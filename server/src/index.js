import config from './config/env.js';
import logger from './utils/logger.js';
import app from './app.js';
import { startScheduler } from './ingestion/scheduler.js';

app.listen(config.PORT, () => {
  logger.info(`StormLeads API listening on port ${config.PORT} [${config.NODE_ENV}]`);
  startScheduler();
});
