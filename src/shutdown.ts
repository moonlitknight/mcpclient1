import { Server } from 'http';
import { logger } from './logger';

export function gracefulShutdown(app: any): void {
  logger.info('Starting graceful shutdown...');

  app.close((err: any) => {
    if (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }

    logger.info('Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}
