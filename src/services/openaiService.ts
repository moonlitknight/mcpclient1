import { Response } from 'express';
import { Readable } from 'stream';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory } from './cacheService';
import { getOpenAIClient } from './openaiClient';

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function processChat(
  prompt: string,
  userId: string,
  config: Config,
  stream?: boolean,
  res?: Response
): Promise<string | void> {
  try {
    const openai = getOpenAIClient();

    const history = getHistory(userId);
    if (history.length === 0) {
      history.push({ role: 'system', content: config.systemPrompt });
    }

    history.push({ role: 'user', content: prompt });

    const payload: any = {
      model: config.model,
      input: history,
      max_output_tokens: config.maxTokens ?? 800,
      stream: stream,
    };

    if (isReasoningModel(config.model) && config.reasoningEffort) {
      payload.reasoning = { effort: config.reasoningEffort };
    }

    if (supportsSamplingKnobs(config.model)) {
      if (typeof config.llmTemperature === "number") payload.temperature = config.llmTemperature;
      if (typeof config.topP === "number") payload.top_p = config.topP;
      if (typeof config.presencePenalty === "number") payload.presence_penalty = config.presencePenalty;
      if (typeof config.frequencyPenalty === "number") payload.frequency_penalty = config.frequencyPenalty;
    }

    logger.info('OpenAI request payload (Responses):', JSON.stringify(payload, null, 2));

    if (stream && res) {
      const openAiStream = await openai.responses.create(payload);
      let fullResponse = '';
      for await (const event of openAiStream) {
        if (event.type === 'response.output_text.delta') {
          const content = event.delta;
          if (content) {
            logger.info('Interim response:', content);
            res.write(JSON.stringify({ response: content }));
            fullResponse += content;
          }
        } else if (event.type === 'response.completed') {
          logger.info('Final response:', event);
        }
      }
      history.push({ role: 'assistant', content: fullResponse });
      updateHistory(userId, history);
      res.end();
    } else {
      const resp = await openai.responses.create(payload);
      const respText =
        (resp as any).output_text ??
        ((resp as any).output?.map((blk: any) =>
          blk?.content?.map((c: any) => c?.text ?? "").join("")
        ).join("") ?? "");

      logger.info('OpenAI response payload:', JSON.stringify(resp, null, 2));

      if (respText) {
        history.push({ role: 'assistant', content: respText });
        updateHistory(userId, history);
        return respText;
      }
      return '';
    }
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    if (res && !res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat request' });
    }
    throw new Error('Failed to process chat request');
  }
}

function isReasoningModel(model: string) {
  return /^(o\d|gpt-5)/i.test(model);
}

function supportsSamplingKnobs(model: string) {
  return !isReasoningModel(model);
}
