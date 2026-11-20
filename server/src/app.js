import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, assertProductionSafety } from './config.js';
import { one } from './db.js';
import { errorHandler, notFoundHandler, requestContext, securityHeaders } from './lib/http.js';
import { pingScanner } from './lib/malware.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import marketplaceRoutes from './routes/marketplace.js';
import professionalRoutes from './routes/professional.js';
import employerRoutes from './routes/employer.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  assertProductionSafety();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'flamingo-api', demoMode: config.demoMode, time: new Date().toISOString() });
  });

  app.get('/api/ready', async (_req, res) => {
    const checks = { database: 'ok', storage: 'ok', scanner: 'ok' };
    try {
      one('SELECT 1 AS ok');
    } catch {
      checks.database = 'failed';
    }
    try {
      fs.accessSync(config.storageDir, fs.constants.W_OK);
    } catch {
      checks.storage = 'failed';
    }
    checks.scanner = await pingScanner();
    const ready =
      checks.database === 'ok' && checks.storage === 'ok' && checks.scanner !== 'failed';
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks,
      time: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/marketplace', marketplaceRoutes);
  app.use('/api/professional', professionalRoutes);
  app.use('/api/employer', employerRoutes);
  app.use('/api/admin', adminRoutes);

  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const indexFile = path.join(config.clientDist, 'index.html');
      if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
      return next();
    });
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
