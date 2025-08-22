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

/**
 * Handle an incoming chat request.
 *
 * This function validates the request body, attempts to validate and decode a Supabase JWT
 * to determine the user id, applies any request-level configuration overrides (such as
 * temperature), and then forwards the request to the OpenAI processing service. It supports
 * both streaming and non-streaming responses.
 *
 * @param req - Express request containing a ChatRequest in req.body
 * @param res - Express response used to send either a streaming response or a JSON payload
 */
export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    // Log the incoming request for debugging purposes - colorize the output to be in cyan and reset the color afterwards
    // Pull expected properties from the request body (supabase_jwt is provided via ?t=token query parameter)
    const { text, stream, tools, tool_outputs, file_ids } = req.body as ChatRequest;
    // Extract supabase_jwt from the URL query parameter `t`
    const supabase_jwt = typeof (req.query as any).t === 'string' ? (req.query as any).t : undefined;
    console.log(`\x1b[36m [ch27] mcp1 Received chat request for user ${supabase_jwt}: ${JSON.stringify(req.body)} `, req.body);
    // reset the terminal color 
    console.log('\x1b[0m');

    // Validate required inputs early and return 400 if missing
    if (!supabase_jwt) {
      res.status(400).json({ error: 'Missing required query parameter: t (token) is required' });
      return;
    }

    let userId: string;

    // Check whether the provided supabase_jwt is valid. If valid, decode it and use the
    // contained email as the user identifier. Otherwise treat the provided value as a plain user id.
    const isJwtValid = await validateSupabaseJWT(supabase_jwt);

    if (isJwtValid) {
      const decodedToken = jwtDecode<DecodedToken>(supabase_jwt as string);
      userId = decodedToken.email;
    } else {
      userId = supabase_jwt as string;
    }

    // Allow request-level overrides (e.g. temperature) on top of the global config
    const { temperature } = req.body as ChatRequest;
    const defaultConfig = getConfig();
    const requestConfig = { ...defaultConfig };

    if (temperature !== undefined) {
      requestConfig.llmTemperature = temperature;
    }

    // Streaming path: set appropriate headers and forward the response stream to the client
    if (stream) {
      res.setHeader('Content-Type', 'application/json');
      await processChat(text, userId, requestConfig, stream, res, tools);
      return;
    }

    // Non-streaming path: wait for a full response and send a structured ChatResponse
    const openAiResponse = await processChat(text, userId, requestConfig, stream, res, tools, tool_outputs, file_ids);
    const response: ChatResponse = {
      output: openAiResponse.output,
      output_text: openAiResponse.output_text,
      metadata: {
        timestamp: new Date().toISOString(),
        status: 'success'
      },
      id: openAiResponse.id,
    };
    res.status(200).json(response);
  } catch (error) {
    // Normalize error message and log with optional request id
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Chat request failed:', new Error(errorMessage), { requestId: (req as any).id });

    // If headers haven't been sent, respond with a consistent ChatResponse error payload
    if (!res.headersSent) {
      const response: ChatResponse = {
        output_text: '[ch84] Internal server error',
        output: [{
          content: [{
            text: '',
            type: 'output_text',
            annotations: []
          }],
          role: 'assistant',
          status: 'completed',
          type: 'message'
        }],
        metadata: {
          timestamp: new Date().toISOString(),
          status: 'error',
          error: '[ch84] Internal server error'
        }
      };
      res.status(500).json(response);
    }
  }
}
