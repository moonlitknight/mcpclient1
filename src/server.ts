import express, { Request, Response } from 'express';
import { logger } from './logger';
import { handleChatRequest } from './chatHandler';
import { Config } from './config';

export function createApp(config: Config) {
  const app = express();

  // Middleware for request ID

  app.get('/health', express.json(), (req, res) => {
    console.log('Received JSON:', req.body);
    res.status(200).json({ message: 'Data logged successfully' });
  });

  // Main chat endpoint
  app.post('/chat', express.json(), async (req, res) => {
    // fix the line below to use the correct type for the request body
    const result = await handleChatRequest(req);
    res.status(result.status);
    res.json(result.body);
    res.end();
    return result.body;
  });


  return app;
}
