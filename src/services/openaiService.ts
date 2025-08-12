import { OpenAI } from 'openai';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory } from './cacheService';
import { getOpenAIClient } from './openaiClient';
import { Response } from 'express';
import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

type Msg = { role: "system" | "user" | "assistant"; content: string };

/**
 * Processes a chat prompt, sends it to the OpenAI API, and streams the response.
 * @param prompt The user's prompt.
 * @param userId The unique identifier for the user.
 * @param config The application configuration.
 * @param res The Express response object to stream the response to.
 */
export async function processChat(prompt: string, userId: string, config: Config, res: Response): Promise<void> {
  try {
    const openai = getOpenAIClient();

    // Retrieve conversation history or start a new one
    const history = getHistory(userId);
    if (history.length === 0) {
      // Add the system prompt to the beginning of the conversation
      history.push({ role: 'system', content: config.systemPrompt });
    }

    // Add the user's prompt to the history
    history.push({ role: 'user', content: prompt });

    // Construct the request payload for the OpenAI API
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

    // Create a chat completion stream
    const stream = await openai.chat.completions.create(requestPayload);

    let assistantResponse = '';
    // Set headers for streaming the response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Process the stream as it comes in
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        assistantResponse += content;
        // Stream the content to the client
        res.write(JSON.stringify({ response: content }));
      }
    }

    // After the stream is complete, update the history with the assistant's response
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

/**
 * Checks if a model is a reasoning model based on its name.
 * @param model The name of the model to check.
 * @returns True if the model is a reasoning model, false otherwise.
 */
function isReasoningModel(model: string) {
  // Adjust this heuristic to your naming: o1/o3/gpt-5/etc.
  return /^(o\d|gpt-5)/i.test(model);
}

/**
 * Checks if a model supports sampling knobs like temperature and top_p.
 * @param model The name of the model to check.
 * @returns True if the model supports sampling knobs, false otherwise.
 */
function supportsSamplingKnobs(model: string) {
  // New reasoning models usually drop temperature/top_p/penalties
  return !isReasoningModel(model);
}
