
import { processChat } from './services/openaiService';
import { validateSupabaseJWT } from './services/supabaseService';
import { logger } from './logger';
import { ChatRequest, ChatResponse } from './types';

export async function handleChatRequest(req: any) {
  try {
    // Validate request

    const { text, supabase_jwt }: ChatRequest = await req.json() as ChatRequest;

    if (!text || !supabase_jwt) {
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
