import express, { Request, Response } from 'express';
import { logger } from './logger';
import { handleChatRequest } from './chatHandler';
import { handleHistoryRequest } from './historyHandler';
import { Config } from './config';
import { setDeveloperPrompt } from './services/cacheService';

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
  // set developerPrompt endpoint
  app.post('/developer', express.text(), async (req: Request, res: Response) => {
    // Extract email key from the URL query parameter `t`
    const email = typeof (req.query as any).t === 'string' ? (req.query as any).t : undefined;
    console.log(`\x1b[36m[hh32] mcp1 Received developer prompt request for user ${email}`);
    // reset the terminal color 
    console.log('\x1b[0m');

    if (!email) {
      res.status(400).json({ error: 'Missing required query parameter: t (email key) is required' });
      return;
    }

    const developerPrompt = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    console.log(`\x1b[36m[hh32] with a body of ${developerPrompt}`, req);
    try {
      setDeveloperPrompt(email, developerPrompt);
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      logger.error('Failed to set developer prompt', err as Error);
      res.status(500).json({ error: 'Failed to set developer prompt' });
    }
  });
  // History endpoint
  app.get('/history', express.json(), async (req: Request, res: Response) => {
    await handleHistoryRequest(req, res);
  });


  return app;
}
