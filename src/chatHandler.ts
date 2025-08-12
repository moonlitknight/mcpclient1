import { Request, Response } from 'express';
import { jwtDecode } from 'jwt-decode';
import { processChat } from './services/openaiService';
import { validateSupabaseJWT } from './services/supabaseService';
import { logger } from './logger';
import { ChatRequest } from './types';
import { getConfig } from './config';

interface DecodedToken {
  email: string;
}

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    const { text, supabase_jwt } = req.body as ChatRequest;

    if (!text || !supabase_jwt) {
      res.status(400).json({ error: 'Missing required fields: text and supabase_jwt are required' });
      return;
    }

    let userId: string;

    const isJwtValid = await validateSupabaseJWT(supabase_jwt);

    if (isJwtValid) {
      const decodedToken = jwtDecode<DecodedToken>(supabase_jwt);
      userId = decodedToken.email;
    } else {
      userId = supabase_jwt;
    }

    const { temperature } = req.body as ChatRequest;
    const defaultConfig = getConfig();
    const requestConfig = { ...defaultConfig };

    if (temperature !== undefined) {
      requestConfig.llmTemperature = temperature;
    }

    await processChat(text, userId, requestConfig, res);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Chat request failed:', new Error(errorMessage), { requestId: (req as any).id });

    if (!res.headersSent) {
      res.status(500).json({
        response: '',
        metadata: {
          timestamp: new Date().toISOString(),
          status: 'error',
          error: 'Internal server error'
        }
      });
    }
  }
}
