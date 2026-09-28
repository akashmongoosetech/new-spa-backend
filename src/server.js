import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

async function start() {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log(`[server] Tripod Wellness API listening on http://localhost:${env.port}`);
    console.log(`[server] Environment: ${env.nodeEnv}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if connections hang.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
});

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
