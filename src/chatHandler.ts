import { Request, Response } from 'express';
import { jwtDecode } from 'jwt-decode';
import { processChat } from './services/openaiService';
import { validateSupabaseJWT } from './services/supabaseService';
import { logger } from './logger';
import { ChatRequest, ChatResponse } from './types';
import { getConfig } from './config';

interface DecodedToken {
  email: string;
}

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    const { text, supabase_jwt, stream } = req.body as ChatRequest;

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

    if (stream) {
        res.setHeader('Content-Type', 'application/json');
        await processChat(text, userId, requestConfig, stream, res);
    } else {
        const openAiResponse = await processChat(text, userId, requestConfig, stream, res);
        const response: ChatResponse = {
            response: openAiResponse as string,
            metadata: {
            timestamp: new Date().toISOString(),
            status: 'success'
            }
        };
        res.status(200).json(response);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Chat request failed:', new Error(errorMessage), { requestId: (req as any).id });

    if (!res.headersSent) {
      const response: ChatResponse = {
        response: '',
        metadata: {
          timestamp: new Date().toISOString(),
          status: 'error',
          error: 'Internal server error'
        }
      };
      res.status(500).json(response);
    }
  }
}
