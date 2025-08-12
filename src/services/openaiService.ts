import { OpenAI } from 'openai';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory } from './cacheService';
import { getOpenAIClient } from './openaiClient';
import { Response } from 'express';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function processChat(prompt: string, userId: string, config: Config, res: Response): Promise<void> {
  try {
    const openai = getOpenAIClient();

    const history = getHistory(userId);
    if (history.length === 0) {
      history.push({ role: 'system', content: config.systemPrompt });
    }

    history.push({ role: 'user', content: prompt });

    const requestPayload: ChatCompletionCreateParams = {
      model: config.model,
      messages: history,
      temperature: config.llmTemperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      presence_penalty: config.presencePenalty,
      frequency_penalty: config.frequencyPenalty,
      stream: true,
    };

    logger.info('OpenAI request payload:', JSON.stringify(requestPayload, null, 2));

    const stream = await openai.chat.completions.create(requestPayload);

    let assistantResponse = '';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        assistantResponse += content;
        console.log("Chunk received:", content);
        res.write(JSON.stringify({ response: content }));
      }
    }

    if (assistantResponse) {
      history.push({ role: 'assistant', content: assistantResponse });
      updateHistory(userId, history);
    }

    res.end();

  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat request' });
    } else {
      res.end();
    }
  }
}

function isReasoningModel(model: string) {
  // Adjust this heuristic to your naming: o1/o3/gpt-5/etc.
  return /^(o\d|gpt-5)/i.test(model);
}

function supportsSamplingKnobs(model: string) {
  // New reasoning models usually drop temperature/top_p/penalties
  return !isReasoningModel(model);
}
