import { initializeConfig } from './config';
import { logger } from './logger';
import { gracefulShutdown } from './shutdown';
import { createApp } from './server';
// import from hono 

async function main() {
  // Initialize configuration
  const config = await initializeConfig();

  // Create and start Hono server
  const app = createApp(config);
  // fix the line below to remove the no overload error
  app.listen(config.httpPort, () => {
    logger.info(`Server is running on port ${config.httpPort}`);
  })

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(app));
  process.on('SIGINT', () => gracefulShutdown(app));
}

main().catch((error) => {
  logger.error('Application failed to start:', error);
  process.exit(1);
});
