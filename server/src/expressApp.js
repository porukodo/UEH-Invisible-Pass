import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import gateRoutes from './routes/gateRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get('/', (req, res) => res.json({ status: 'ok', service: 'UEH Invisible Pass API' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/gate', gateRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/cron', cronRoutes);

  app.use(errorHandler);

  return app;
}
