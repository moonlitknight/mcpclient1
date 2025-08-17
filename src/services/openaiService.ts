/**
 * Module for handling OpenAI chat interactions including streaming and standard responses.
 * @module openaiService
 */

import { OpenAI } from 'openai';
import { Response } from 'express';
import { Readable } from 'stream';
import { Config } from '../config';
import { logger } from '../logger';
import { getHistory, updateHistory, getPreviousResponseId, updatePreviousResponseId } from './cacheService';
import { getOpenAIClient } from './openaiClient';
import { ChatResponse, FunctionTool, ResponseOutputItem } from '../types';
import { OutputItems } from 'openai/resources/evals/runs/output-items';

type Msg = { role: "system" | "user" | "assistant"; content: string };

/**
 * Processes a chat request, handling both streaming and standard results.
 * @async
 * @function processChat
 * @param {string} prompt - The user's input prompt
 * @param {string} userIdJwt - Unique identifier for the user using the Supabase JWT
 * @param {Config} config - Configuration object
 * @param {boolean} [stream] - Whether to use streaming response
 * @param {Response} [res] - Express response object for streaming
 * @param {FunctionTool[]} [tools] - Optional tools for function calling
 * @returns {Promise<string>} - The processed response text
 * @throws {Error} If the chat request fails
 */
export async function processChat(
  prompt: string,
  userIdJwt: string,
  config: Config,
  stream?: boolean,
  res?: Response,
  tools?: FunctionTool[],
  tool_outputs?: { call_id: string; output: string }[]
): Promise<ChatResponse> {
  try {
    const openai = getOpenAIClient();
    const history = getHistory(userIdJwt);

    // Initialize history if empty
    if (history.length === 0) {
      history.push({ role: 'system', content: config.systemPrompt });
    }
    history.push({ role: 'user', content: prompt });

    const payload = createPayload(prompt, userIdJwt, config, stream, tools, tool_outputs);
    // log the payload for debugging purposes. Colorize it to be in green
    console.log('\x1b[32m%s\x1b[0m', 'OpenAI request payload:' + JSON.stringify(payload, null, 2));
    // reset the terminal color afterwards
    console.log('\x1b[0m');

    if (stream && res) {
      //@ts-ignore
      return await processStreamResponse(openai, payload, userIdJwt, res);
    } else {
      return await processNonStreamResponse(openai, payload, userIdJwt);
    }
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    if (res && !res.headersSent) {
      res.status(500).json({ error: 'Failed to process chat request' });
    }
    throw new Error('Failed to process chat request');
  }
}

/**
 * Creates the payload for OpenAI API requests.
 * @function createPayload
 * @param {string} prompt - The user's input prompt
 * @param {string} userId - Unique identifier for the user
 * @param {Config} config - Configuration object
 * @param {boolean} [stream] - Whether to use streaming
 * @param {FunctionTool[]} [tools] - Optional tools for function calling
 * @returns {Object} The constructed payload object
 *
 */
function createPayload(
  prompt: string,
  userId: string,
  config: Config,
  stream?: boolean,
  tools?: FunctionTool[],
  tool_outputs?: { call_id: string; output: string }[]
): OpenAI.Responses.Response {
  const payload: any = {
    model: config.model,
    input: [],
    max_output_tokens: config.maxTokens ?? 800,
    stream: stream,
  };

  const previousResponseId = getPreviousResponseId(userId);
  if (previousResponseId) {
    payload.previous_response_id = previousResponseId;
  }

  // if we are called with tool_outputsm then this means we are responding to a function call request which changes the input structure
  if (tool_outputs && tool_outputs.length > 0) {
    payload.input = tool_outputs;
    // add a property `type:"function_call_output"` to each tool output item
    payload.input.forEach((output: any) => {
      output.type = "function_call_output";
    });
  } else {
    payload.input = [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: prompt }
    ];
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

  return payload;
}

/**
 * Processes a streaming response from OpenAI.
 * @async
 * @function processStreamResponse
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Object} payload - The request payload
 * @param {string} userId - Unique identifier for the user
 * @param {Response} res - Express response object
 * @returns {Promise<string>} The full response content
 * @deprecated Only because I havent tested it recently. 
 */
async function processStreamResponse(
  openai: OpenAI,
  payload: any,
  userId: string,
  res: Response
): Promise<string> {
  console.warn('processStreamResponse is deprecated only because I havent tested it recently. It should still work.');
  const openAiStream = await openai.responses.create(payload, { stream: true });
  let fullResponse = '';
  let responseId: string | undefined;

  const asyncIterable = openAiStream as unknown as AsyncIterable<{
    id?: string;
    choices?: Array<{ delta?: { content?: string, tool_calls?: any } }>
  }>;

  for await (const chunk of asyncIterable) {
    if (chunk.id) {
      responseId = chunk.id;
    }

    if (chunk.choices?.[0]?.delta?.tool_calls) {
      logger.info('Tool calls requested:', chunk.choices[0].delta.tool_calls);
    }

    const content = chunk.choices?.[0]?.delta?.content || '';
    if (content) {
      res.write(JSON.stringify({ response: content }));
      fullResponse += content;
    }
  }

  if (responseId) {
    updatePreviousResponseId(userId, responseId);
  }
  updateHistory(userId, [...getHistory(userId), { role: 'assistant', content: fullResponse }]);
  res.end();
  return fullResponse;
}

/**
 * Processes a standard (non-streaming) response from OpenAI.
 * @async
 * @function processStandardResponse
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Object} payload - The request payload
 * @param {string} userId - Unique identifier for the user
 * @returns {Promise<string>} The response text
 */
async function processNonStreamResponse(
  openai: OpenAI,
  payload: any,
  userId: string
): Promise<ChatResponse> {
  const openaiResponseBody = await openai.responses.create(payload);
  const chatResponse: ChatResponse = {
    output: [],
    output_text: '',
    metadata: {
      timestamp: new Date().toISOString(),
      status: 'success',
    },
  };
  // log the response  for debugging purposes. Colorize it to be in pink
  console.log('\x1b[35m%s\x1b[0m', 'mcp1 OpenAI response body:' + JSON.stringify(openaiResponseBody, null, 2));
  // reset the terminal color afterwards
  console.log('\x1b[0m');
  chatResponse.output = openaiResponseBody.output as ResponseOutputItem[];
  chatResponse.output_text = openaiResponseBody.output_text || '';
  const respText =
    (openaiResponseBody as any).output_text ??
    ((openaiResponseBody as any).output?.map((blk: any) =>
      blk?.content?.map((c: any) => c?.text ?? "").join("")
    ).join("") ?? "");

  // logger.info('OpenAI response payload:', JSON.stringify(openaiResponseBody, null, 2));

  if ((openaiResponseBody as any).tool_calls) {
    logger.info('Tool calls requested:', (openaiResponseBody as any).tool_calls);
  }

  if (openaiResponseBody.id) {
    updatePreviousResponseId(userId, openaiResponseBody.id);
  }

  if (respText) {
    updateHistory(userId, [...getHistory(userId), { role: 'assistant', content: respText }]);
  }
  return chatResponse;
}

/**
 * Checks if a model is a reasoning model.
 * @function isReasoningModel
 * @param {string} model - The model name to check
 * @returns {boolean} True if the model is a reasoning model
 */
function isReasoningModel(model: string) {
  return /^(o\d|gpt-5)/i.test(model);
}

/**
 * Checks if a model supports sampling parameters.
 * @function supportsSamplingKnobs
 * @param {string} model - The model name to check
 * @returns {boolean} True if the model supports sampling parameters
 */
function supportsSamplingKnobs(model: string) {
  return !isReasoningModel(model);
}
