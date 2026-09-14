import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimiter';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import userRoutes from './routes/user.routes';
import leadRoutes from './routes/lead.routes';
import contactRoutes from './routes/contact.routes';
import companyRoutes from './routes/company.routes';
import dealRoutes from './routes/deal.routes';
import activityRoutes from './routes/activity.routes';
import conversationRoutes from './routes/conversation.routes';
import taskRoutes from './routes/task.routes';
import productRoutes from './routes/product.routes';
import dashboardRoutes from './routes/dashboard.routes';
import aiRoutes from './routes/ai.routes';
import recommendationRoutes from './routes/recommendation.routes';
import insightRoutes from './routes/insight.routes';
import forecastRoutes from './routes/forecast.routes';
import reportRoutes from './routes/report.routes';
import integrationRoutes from './routes/integration.routes';
import importRoutes from './routes/import.routes';
import notificationRoutes from './routes/notification.routes';
import auditRoutes from './routes/audit.routes';
import settingsRoutes from './routes/settings.routes';
import autonomyRoutes from './routes/autonomy.routes';
import searchRoutes from './routes/search.routes';
import meetingRoutes from './routes/meeting.routes';
import contentRoutes from './routes/content.routes';
import approvalRoutes from './routes/approval.routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) },
    })
  );
  app.use(generalLimiter);

  app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date() } }));

  app.use('/api/auth', authRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/insights', insightRoutes);
  app.use('/api/forecast', forecastRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/autonomy', autonomyRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/meetings', meetingRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/approvals', approvalRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
