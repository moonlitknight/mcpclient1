import { initializeConfig } from './config';
import { logger } from './logger';
import { gracefulShutdown } from './shutdown';
import { createApp } from './server';

async function main() {
  // Initialize configuration
  const config = await initializeConfig();

  // Create and start express server
  const app = createApp(config);
  const server = app.listen(config.httpPort, (err) => {
    if (!!err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
    logger.info(`Server is running on port ${config.httpPort}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(server));
  process.on('SIGINT', () => gracefulShutdown(server));
}

main().catch((error) => {
  logger.error('Application failed to start:', error);
  process.exit(1);
});
