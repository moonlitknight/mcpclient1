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
import { ResponseInputItem } from 'openai/resources/responses/responses';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

type Msg = ChatCompletionMessageParam;

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
  email: string,
  config: Config,
  stream?: boolean,
  res?: Response,
  tools?: FunctionTool[],
  tool_outputs?: { call_id: string; output: string }[]
): Promise<ChatResponse> {
  try {
    const openai = getOpenAIClient();
    // Retrieve and persist history so subsequent reads reflect appended messages
    let history = getHistory(email);

    // Initialize history if empty and persist the initial system prompt
    if (history.length === 0) {
      history = [{ role: 'system', content: config.systemPrompt }];
      updateHistory(email, history);
    }

    // Append the user prompt and persist immediately so later reads include it
    history = [...history, { role: 'user', content: prompt }];
    // check if this prompt is a function call output, if so, do not store this in history. This is to prevent it being displayed in the client UI
    if (tool_outputs && tool_outputs.length > 0) {
      // do not store the function call output in history
      console.info('[oai58] Skipping history update for function call output:', tool_outputs);
    } else {
      updateHistory(email, history);
    }
    const payload = createPayload(prompt, email, config, stream, tools, tool_outputs);
    // log the payload for debugging purposes. Colorize it to be in green
    console.log('\x1b[32m%s\x1b[0m', 'OpenAI request payload:' + JSON.stringify(payload, null, 2));
    // reset the terminal color afterwards
    console.log('\x1b[0m');

    if (stream && res) {
      //@ts-ignore
      return await processStreamResponse(openai, payload, email, res);
    } else {
      return await processNonStreamResponse(openai, payload, email, config);
    }
  } catch (error) {
    logger.error('OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    if (res && !res.headersSent) {
      res.status(500).json({ error: '[oai77] Failed to process chat request' });
    }
    throw new Error('[oai77] Failed to process chat request');
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
  email: string,
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

  const previousResponseId = getPreviousResponseId(email);
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
    payload.input = [];
    // if this is the first response in the conversation, add the system prompt
    if (!previousResponseId) {
      payload.input.push({ role: 'system', content: config.systemPrompt });
    }
    payload.input.push({ role: 'user', content: prompt });
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
  email: string,
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
    updatePreviousResponseId(email, responseId);
  }
  updateHistory(email, [...getHistory(email), { role: 'assistant', content: fullResponse }]);
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
  email: string,
  config: Config
): Promise<ChatResponse> {
  // ===== call OpenAI API =========================================
  let openaiResponseBody;
  try {
    openaiResponseBody = await openai.responses.create(payload);
  } catch (error: any) {  // this is all about catching the error caused by a missing runctional call answer
    logger.error('[oai 204]OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    logger.error('[oai 204]OpenAI request failed', error instanceof Error ? error : new Error(String(error)));
    console.error('[oai 205] OpenAI request failed', openaiResponseBody);
    console.error('[oai 206] OpenAI request failed', error);
    console.error('[oai 206a] OpenAI request failed', error && error.error ? error.error.message : String(error));
    if (error && error.error && error.error.message && error.error.message.includes('function call')) {
      const functionErrorPayload = makeFunctionCallErrorPayload(error.error.message, payload, config);
      try {
        openaiResponseBody = await openai.responses.create(functionErrorPayload);
      } catch (error2: any) {
        logger.error('[oai 214] OpenAI request failed with function call error', error2 instanceof Error ? error2 : new Error(String(error2)));
        console.error('[oai 215] OpenAI request failed with function call error', openaiResponseBody);
      }
    }
  }
  // ================================================================
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
  chatResponse.output = openaiResponseBody!.output as ResponseOutputItem[];
  chatResponse.output_text = openaiResponseBody!.output_text || '';
  const respText =
    (openaiResponseBody as any).output_text ??
    ((openaiResponseBody as any).output?.map((blk: any) =>
      blk?.content?.map((c: any) => c?.text ?? "").join("")
    ).join("") ?? "");

  // logger.info('OpenAI response payload:', JSON.stringify(openaiResponseBody, null, 2));

  if ((openaiResponseBody as any).tool_calls) {
    logger.info('Tool calls requested:', (openaiResponseBody as any).tool_calls);
  }

  if (openaiResponseBody!.id) {
    updatePreviousResponseId(email, openaiResponseBody!.id);
  }

  if (respText) {
    updateHistory(email, [...getHistory(email), { role: 'assistant', content: respText }]);
  }
  return chatResponse;
}

/**
 * This is necessary because OpenAI will refuse to process any prompts within a conversation until it receives a valid function call response.
 * Normally that will not happen, but if it does we end up with an ugly client error condition for which there is no recovery without reloading the mcp1 server to
 * reset the conversation.
 * Takes the inital payload and the error message and creates a new payload for the function call error.
 * The messages is of the form 'No tool output found for function call call_Zyy2Z9PgYUZUZ01B7iKppSkS.'
 * wthe call id begins with 'call_' and is followed by a unique identifier.
 * @param {string} errorMessage - The error message from the function call
 * @param {any} payload - The original payload used for the function call
 * @returns {any} The modified payload to include a tool response to satisfy OpenAI
 */
function makeFunctionCallErrorPayload(errorMessage: string, payload: any, config: Config): any {
  // this live version of the fix works by clearing the previous_response_id and adding a system prompt
  const functionCallErrorPayload: OpenAI.Responses.ResponseCreateParams = {
    ...payload,
  };
  // delete the previous_response_id if it exists and add a system prompt
  delete functionCallErrorPayload.previous_response_id;
  //@ ts-ignore
  (<Array<ResponseInputItem>>functionCallErrorPayload.input).push({ role: 'system', content: config.systemPrompt });
  /*
   * All of this commented out code is trying to provide a function call response that will allow the convo to continue
   * but there is something wrong with it and OpenAI spits it out with an error.
  // parse the error message to extract the function call id
  const call_id: string = errorMessage.match(/call_[a-zA-Z0-9]+/)![0];
  console.info('call_id', call_id);
  const functionCallErrorPayload: OpenAI.Responses.Response = {
    ...payload,
    input: [
      {
        type: "function_call_output",
        call_id: call_id,
        output: "No tool output found for function call " + call_id + ". This is a placeholder response to satisfy OpenAI's requirement for a function call response."
      },
    ],
    tools: payload.tools,
  };
  console.warn('[oai 283] makeFunctionCallErrorPayload', functionCallErrorPayload);
  */
  console.warn('[oai 283] makeFunctionCallErrorPayload as json', JSON.stringify(functionCallErrorPayload));
  return functionCallErrorPayload;
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
