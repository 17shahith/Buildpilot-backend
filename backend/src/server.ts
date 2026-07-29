import app from './app';
import prisma from './database';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[BuildBridge API] Connecting to MongoDB via Prisma...');
    await prisma.$connect();
    console.log('[BuildBridge API] Database connected successfully!');
    
    app.listen(PORT, () => {
      console.log(`[BuildBridge API] Server running successfully on port ${PORT}`);
    });
  } catch (error) {
    console.error('[BuildBridge API] Failed to connect to database on startup:', error);
    process.exit(1);
  }
}

startServer();

