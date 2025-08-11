import { initializeConfig } from './config';
import { logger } from './logger';
import { gracefulShutdown } from './shutdown';
import { createApp } from './server';
import { processChat } from './services/openaiService';

async function main() {
  // Initialize configuration
  const config = await initializeConfig();

  // Post a test query to OpenAI
  try {
    logger.info('Sending test query to OpenAI...');
    const testQuery = "What is the capital of France?";
    const response = await processChat(testQuery);
    logger.info(`Test query response: ${response}`);
  } catch (error) {
    logger.error('Failed to send test query to OpenAI', error instanceof Error ? error : new Error(String(error)));
  }

  // Create and start express server
  const app = createApp(config);
  const server = app.listen(config.httpPort, () => {
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
