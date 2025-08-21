import { Request, Response } from 'express';
import { logger } from './logger';
import { getHistory } from './services/cacheService';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface DecodedToken {
  email: string;
}

/**
 * Handle a request to return a user's chat history.
 *
 * The handler derives the Supabase JWT from the `t` query parameter (same as chatHandler),
 * validates/decodes it to obtain a user identifier, then looks up the conversation history
 * from the cacheService and returns an array of objects of the form:
 *   { text: string, direction: 'in' | 'out' }
 *
 * "in" means a prompt sent to OpenAI (roles 'user' and 'system'),
 * "out" means a response from OpenAI (role 'assistant').
 *
 * @param req - Express request
 * @param res - Express response
 */
export async function handleHistoryRequest(req: Request, res: Response): Promise<void> {
  try {

    // Extract email key from the URL query parameter `t`
    const email = typeof (req.query as any).t === 'string' ? (req.query as any).t : undefined;
    console.log(`\x1b[36m[hh32] mcp1 Received history request for user ${email}`);
    // reset the terminal color 
    console.log('\x1b[0m');

    if (!email) {
      res.status(400).json({ error: 'Missing required query parameter: t (email key) is required' });
      return;
    }

    const rawHistory: ChatCompletionMessageParam[] = getHistory(email);

    const history = rawHistory.map((msg) => {
      // msg.content may be a string or more structured in different flows; handle common cases
      let text: string;
      if (typeof (msg as any).content === 'string') {
        text = (msg as any).content;
      } else if (Array.isArray((msg as any).content)) {
        // join array items if present
        text = (msg as any).content.map((c: any) => (typeof c === 'string' ? c : JSON.stringify(c))).join('');
      } else {
        text = JSON.stringify((msg as any).content);
      }

      const role = (msg as any).role as string;
      const direction = role === 'assistant' ? 'out' : 'in';

      return { text, direction } as { text: string; direction: 'in' | 'out' };
    });
    console.log(`\x1b[36m[hh42] mcp1 Returning history for user ${email}: ${JSON.stringify(history)}`);

    res.status(200).json(history);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('History request failed:', new Error(errorMessage), { requestId: (req as any).id });

    if (!res.headersSent) {
      res.status(500).json({ error: '[hh01] Internal server error' });
    }
  }
}
