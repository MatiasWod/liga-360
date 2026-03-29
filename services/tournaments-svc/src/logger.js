import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

const service = 'tournaments-svc';

export const logger = pino({
  name: service,
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service,
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const headerId = req.headers['x-request-id'];
    const id = (Array.isArray(headerId) ? headerId[0] : headerId) || randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: function customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

