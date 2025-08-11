import OpenAI from 'openai';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory } from './cacheService';

export async function processChat(prompt: string, userId: string, config: Config): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: config.openaiKey
    });

    const history = getHistory(userId);
    if (history.length === 0) {
      history.push({ role: 'system', content: 'You are a helpful assistant.' });
    }

    history.push({ role: 'user', content: prompt });

    const requestPayload: ChatCompletionCreateParams = {
      model: 'gpt-3.5-turbo',
      messages: history,
      temperature: config.llmTemperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      presence_penalty: config.presencePenalty,
      frequency_penalty: config.frequencyPenalty,
      stream: false
    };

    logger.info('OpenAI request payload:', JSON.stringify(requestPayload, null, 2));

    const completion = await openai.chat.completions.create(requestPayload);

    logger.info('OpenAI response payload:', JSON.stringify(completion, null, 2));

    const assistantResponse = completion.choices[0]?.message;
    if (assistantResponse) {
      history.push(assistantResponse);
      updateHistory(userId, history);
      return assistantResponse.content || '';
    }

    return '';
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to process chat request');
  }
}
