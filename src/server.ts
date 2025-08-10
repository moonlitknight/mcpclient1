import { Hono } from 'hono';
import { logger } from './logger';
import { handleChatRequest } from './chatHandler';
import { Config } from './config';

export function createHonoApp(config: Config) {
  const app = new Hono();

  // Middleware for request ID
  app.use('*', async (c, next) => {
    await next();
  });

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  // Main chat endpoint
  app.post('/chat', async (c) => {
    // fix the line below to use the correct type for the request body
    const result = await handleChatRequest(c.req);
    return c.json(result.body);
  });

  // Error handling
  app.onError((err, c) => {
    logger.error('Unhandled error', err);
    return c.json({
      error: 'Internal server error',
    }, 500);
  });

  return app;
}
