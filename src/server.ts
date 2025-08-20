import express, { Request, Response } from 'express';
import { logger } from './logger';
import { handleChatRequest } from './chatHandler';
import { handleHistoryRequest } from './historyHandler';
import { Config } from './config';

export function createApp(config: Config) {
  const app = express();

  // Middleware for request ID

  app.get('/health', express.json(), (req, res) => {
    console.log('Received JSON:', req.body);
    res.status(200).json({ message: 'Data logged successfully' });
  });

  // Main chat endpoint
  app.post('/chat', express.json(), async (req: Request, res: Response) => {
    await handleChatRequest(req, res);
  });
  // History endpoint
  app.get('/history', express.json(), async (req: Request, res: Response) => {
    await handleHistoryRequest(req, res);
  });


  return app;
}
