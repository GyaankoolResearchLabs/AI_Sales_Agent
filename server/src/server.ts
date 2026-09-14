import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createApp } from './app';
import { connectPrisma } from './config/prisma';
import { env } from './config/env';
import { logger } from './utils/logger';
import { setIO } from './realtime/io';
import { startScheduler } from './jobs/scheduler';
import { AccessTokenPayload } from './middleware/auth';

async function main() {
  await connectPrisma();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing auth token'));
      const decoded = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
      socket.data.userId = decoded.sub;
      socket.data.organizationId = decoded.org;
      next();
    } catch {
      next(new Error('Invalid auth token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.join(`org:${socket.data.organizationId}`);
  });

  setIO(io);

  server.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port} [${env.nodeEnv}]`);
    logger.info(`AI provider: ${env.aiProvider}${env.aiProvider === 'anthropic' && !env.aiApiKey ? ' (WARNING: AI_API_KEY not set, falling back to local provider)' : ''}`);
  });

  startScheduler();

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err instanceof Error ? err.message : err });
  process.exit(1);
});
