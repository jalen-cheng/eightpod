import express, { Express } from 'express';
import cors from 'cors';
import logger from '../logger.js';

import os from 'os';
import { isAllowedOrigin } from './allowedOrigin.js';

// Read on every request: the Pod can be renamed while the server runs (setup_local_name.sh)
const getOriginRules = () => ({ podHostname: os.hostname(), extraAllowedOrigin: process.env.ALLOWED_ORIGIN });

export default function (app: Express) {
  app.use((req, res, next) => {
    const startTime = Date.now();

    // Hook into the response `finish` event to log after the response is sent
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });

    next();
  });

  app.use(express.json());

  // Allow local development
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin, getOriginRules())) {
          return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
      }
    })
  );

  // Logging
  app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    const method = req.method;
    const endpoint = req.originalUrl;
    logger.debug(`${method} ${endpoint} - IP: ${clientIp}`);
    next();
  });
}
