import OpenAI from 'openai';
import { Config } from '../config';
import { logger } from '../logger';

export async function processChat(prompt: string, config: Config): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: config.openaiKey
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: config.llmTemperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      presence_penalty: config.presencePenalty,
      frequency_penalty: config.frequencyPenalty
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to process chat request');
  }
}
