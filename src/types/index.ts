import { OpenAI } from "openai";

export interface ChatRequest {
  text: string;
  temperature?: number;
  stream?: boolean;
  // tools?: OpenAI.Responses.FunctionTool[]  this is the OpenAI version
  tools?: FunctionTool[]  // this is my version without OpenAI dependency so it can be shared with the client;
}
export interface FunctionTool {
  type: "function";
  name: string;
  description?: string;
  parameters: FunctionParameters[];
}
export type FunctionParameters = Record<string, unknown>;



export interface ChatResponse {
  output: Array<ResponseOutputMessage | ResponseFunctionToolCall>
  metadata: {
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
  };
  id: string;
}
export interface ResponseOutputMessage {
  content: Array<ResponseOutputText | ResponseOutputRefusal>;
  role: 'assistant';
  status: 'in_progress' | 'completed' | 'incomplete';
  type: 'message';
}
export interface ResponseOutputText {
  annotations: Array<any>;
  //   ResponseOutputText.FileCitation | ResponseOutputText.URLCitation | ResponseOutputText.FilePath
  // >;
  text: string;
  type: 'output_text';
  logprobs?: Array<any>
}
export interface ResponseOutputRefusal {
  /**
   * The refusal explanationfrom the model.
   */
  refusal: string;

  /**
   * The type of the refusal. Always `refusal`.
   */
  type: 'refusal';
}
export interface ResponseFunctionToolCall {
  /**
   * A JSON string of the arguments to pass to the function.
   */
  arguments: string;
  call_id: string;
  name: string;
  type: 'function_call';
  id?: string;
  status?: 'in_progress' | 'completed' | 'incomplete';
}
