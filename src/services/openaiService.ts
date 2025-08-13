import { OpenAI } from 'openai';
import { Response } from 'express';
import { Readable } from 'stream';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory, getPreviousResponseId, updatePreviousResponseId } from './cacheService';
import { getOpenAIClient } from './openaiClient';

type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function processChat(
  prompt: string,
  userId: string,
  config: Config,
  stream?: boolean,
  res?: Response,
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
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
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: config.maxTokens ?? 800,
      stream: stream,
    };

    const previousResponseId = getPreviousResponseId(userId);
    if (previousResponseId) {
        payload.previous_response_id = previousResponseId;
    }

    if (tools) {
        payload.tools = tools;
    }

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
      const openAiStream = await openai.responses.create(payload, { stream: true });

      let fullResponse = '';
      let responseId: string | undefined;
      // Convert the stream to async iterable explicitly
      const asyncIterable = openAiStream as unknown as AsyncIterable<{
        id?: string;
        choices?: Array<{ delta?: { content?: string, tool_calls?: any } }>
      }>;

      for await (const chunk of asyncIterable) {
        console.log('See stderr in /tmp/stderr for detailed response logging'); // Debug raw chunk
        process.stderr.write('Raw stream chunk:' + JSON.stringify(chunk, null, 2)); // Debug raw chunk

        if (chunk.id) {
            responseId = chunk.id;
        }

        if (chunk.choices?.[0]?.delta?.tool_calls) {
            console.log('Tool calls requested:');
            console.log(JSON.stringify(chunk.choices[0].delta.tool_calls, null, 2));
        }

        const content = chunk.choices?.[0]?.delta?.content || '';
        //@ts-ignore
        if (chunk['delta']) process.stdout.write(chunk['delta']);
        if (content) {
          process.stderr.write('Interim content:' + content); // Debug content
          res.write(JSON.stringify({ response: content }));
          if (content) console.log(content);
          fullResponse += content;
        } else {
          process.stderr.write('Empty content in chunk'); // Debug empty chunks
        }
      }
      if (responseId) {
        updatePreviousResponseId(userId, responseId);
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

      if ((resp as any).tool_calls) {
        console.log('Tool calls requested:');
        console.log(JSON.stringify((resp as any).tool_calls, null, 2));
      }

      if (resp.id) {
        updatePreviousResponseId(userId, resp.id);
      }

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
