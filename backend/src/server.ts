import 'dotenv/config';
import http from 'node:http';
import app from './app';
import prisma from './database';
import { getConfig } from './config';
import { connectRedis, disconnectRedis } from './rateLimit';

let server: http.Server | undefined;

async function startServer() {
  try {
    const config = getConfig();
    console.log('[BuildBridge API] Connecting to PostgreSQL via Prisma...');
    await prisma.$connect();
    await connectRedis();
    server = app.listen(config.port, () => console.log(`[BuildBridge API] Server listening on port ${config.port}`));
  } catch (error) {
    console.error('[BuildBridge API] Startup failed:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`[BuildBridge API] ${signal} received; shutting down`);
  server?.close(async () => {
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.on('unhandledRejection', (reason) => console.error('[BuildBridge API] Unhandled rejection:', reason));
process.on('uncaughtException', (error) => {
  console.error('[BuildBridge API] Uncaught exception:', error.message);
  void shutdown('uncaughtException');
});

void startServer();
