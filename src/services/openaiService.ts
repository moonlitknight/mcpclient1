import { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory } from './cacheService';
import { getOpenAIClient } from './openaiClient';

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function processChat(prompt: string, userId: string, config: Config): Promise<string> {
  try {
    const openai = getOpenAIClient();

    const history = getHistory(userId);
    if (history.length === 0) {
      history.push({ role: 'system', content: config.systemPrompt });
    }

    history.push({ role: 'user', content: prompt });

    // const requestPayload: ChatCompletionCreateParams = {
    //   model: config.model,
    //   messages: history,
    //   temperature: config.llmTemperature,
    //   max_completion_tokens: config.maxTokens,
    //   top_p: config.topP,
    //   presence_penalty: config.presencePenalty,
    //   frequency_penalty: config.frequencyPenalty,
    //   stream: false
    // };
    //
    // logger.info('OpenAI request payload:', JSON.stringify(requestPayload, null, 2));
    //
    // const completion = await openai.chat.completions.create(requestPayload);

    const useResponsesAPI = true; // set to false to keep Chat Completions

    let resp = {};
    let respText = '';
    if (useResponsesAPI) {
      // Build the Responses payload
      // The Responses API accepts `input` as an array of chat-style messages.
      // Keep system + prior messages byte-identical across calls to maximize caching.
      const payload: any = {
        model: config.model,
        input: history, // [{role, content}, ...]
        max_output_tokens: config.maxTokens ?? 800
      };

      // Reasoning controls (only for reasoning models)
      if (isReasoningModel(config.model) && config.reasoningEffort) {
        payload.reasoning = { effort: config.reasoningEffort };
      }

      // Old sampling knobs (only if supported by the model)
      if (supportsSamplingKnobs(config.model)) {
        if (typeof config.llmTemperature === "number") payload.temperature = config.llmTemperature;
        if (typeof config.topP === "number") payload.top_p = config.topP;
        if (typeof config.presencePenalty === "number") payload.presence_penalty = config.presencePenalty;
        if (typeof config.frequencyPenalty === "number") payload.frequency_penalty = config.frequencyPenalty;
      }

      // Log request (optional)
      // logger.info('OpenAI request payload (Responses):', JSON.stringify(payload, null, 2));
      resp = await openai.responses.create(payload);
      // Extract text robustly
      respText =
        (resp as any).output_text ??
        // Fallback: flatten output blocks if output_text isn’t present
        ((resp as any).output?.map((blk: any) =>
          blk?.content?.map((c: any) => c?.text ?? "").join("")
        ).join("") ?? "");
    }


    logger.info('OpenAI response payload:', JSON.stringify(resp, null, 2));

    const assistantResponse = respText;
    if (assistantResponse) {
      history.push({ role: 'assistant', content: assistantResponse });
      updateHistory(userId, history);
      return respText || '';
    }

    return '';
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    throw new Error('Failed to process chat request');
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
