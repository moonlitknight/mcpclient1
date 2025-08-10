import express, { Request, Response } from 'express';
import { processChat } from './services/openaiService';
import { validateSupabaseJWT } from './services/supabaseService';
import { logger } from './logger';
import { ChatRequest, ChatResponse } from './types';

export async function handleChatRequest(req: Request) {
  try {
    // Validate request

    // const { text, supabase_jwt }: ChatRequest = await req.body() as ChatRequest;
    console.log('Received request body:', req.body);
    // console.log('Received request body:', req);
    const { text, supabase_jwt }: ChatRequest = await req.body as ChatRequest;

    if (!text || !supabase_jwt) {
      console.error('Missing required fields: text and supabase_jwt are required');
      return {
        status: 400, body: {
          error: 'Missing required fields: text and supabase_jwt are required'
        }
      }
    }
    return { status: 200, body: Response };
  } catch (error) {
    logger.error('Chat request failed', error instanceof Error ? error : new Error(String(error)));
    return {
      status: 500, body: {
        error: 'Internal server error',
        requestId: (req as any).id
      }
    }
  }
}
