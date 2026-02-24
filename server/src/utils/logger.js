import pino from 'pino';
import config from '../config/env.js';

const transport =
  config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined;

const logger = pino({ level: 'info', ...(transport ? { transport } : {}) });

export default logger;
