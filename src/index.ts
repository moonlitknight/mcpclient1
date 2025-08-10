import { initializeConfig } from './config';
import { logger } from './logger';
import { gracefulShutdown } from './shutdown';
import { createHonoApp } from './server';
// import from hono 

async function main() {
  // Initialize configuration
  const config = await initializeConfig();

  // Create and start Hono server
  const app = createHonoApp(config);
  app.fire();

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(app));
  process.on('SIGINT', () => gracefulShutdown(app));
}

main().catch((error) => {
  logger.error('Application failed to start:', error);
  process.exit(1);
});
