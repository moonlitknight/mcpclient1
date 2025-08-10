import OpenAI from 'openai';
import { getConfig } from '../config';
import { logger } from '../logger';

export async function processChat(prompt: string): Promise<string> {
  try {
    const config = getConfig();
    const openai = new OpenAI({
      apiKey: config.openaiKey
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: config.llmTemperature
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to process chat request');
  }
}
