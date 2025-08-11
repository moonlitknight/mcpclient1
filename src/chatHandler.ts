import express, { Request, Response } from 'express';
import { jwtDecode } from 'jwt-decode';
import { processChat } from './services/openaiService';
import { validateSupabaseJWT } from './services/supabaseService';
import { logger } from './logger';
import { ChatRequest, ChatResponse } from './types';
import { getConfig } from './config';

interface DecodedToken {
  email: string;
}

export async function handleChatRequest(req: Request): Promise<{ status: number, body: any }> {
  try {
    const { text, supabase_jwt } = req.body as ChatRequest;

    if (!text || !supabase_jwt) {
      return {
        status: 400,
        body: { error: 'Missing required fields: text and supabase_jwt are required' }
      };
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

    const openAiResponse = await processChat(text, userId, requestConfig);

    const response: ChatResponse = {
      response: openAiResponse,
      metadata: {
        timestamp: new Date().toISOString(),
        status: 'success'
      }
    };

    return { status: 200, body: response };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Chat request failed:', new Error(errorMessage), { requestId: (req as any).id });

    const response: ChatResponse = {
      response: '',
      metadata: {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: 'Internal server error'
      }
    };
    return {
      status: 500,
      body: response
    };
  }
}
