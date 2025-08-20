/**
 *
 *
 *
 *
 *
 *  This file is shared.
 *  It should only be edited within the mcp1 project and then copied to astrosb project.
 *  After copying, comment out the import OpenAI line.
 *
 *  cp src/types.ts ../../sluroy/astrosb/src/types.ts
 *
 *
 *
 *
 *
 *
 */
import { OpenAI } from "openai";

/**
 * this is payload we exect to be called with from SLUad
 */
export interface ChatRequest {
  text: string;
  temperature?: number;
  stream?: boolean;
  supabase_jwt?: string | {}; // not used
  // tools?: OpenAI.Responses.FunctionTool[]  this is the OpenAI version
  tools?: FunctionTool[];  // this is my version without OpenAI dependency so it can be shared with the client;
  tool_outputs?: [{   // optional tool output is SLUad is responding to a function call request
    "call_id": string,
    "output": string
  }]
}
export interface FunctionTool {
  type: "function";
  name: string;
  description?: string;
  parameters: FunctionParameters[];
}
export type FunctionParameters = Record<string, unknown>;



/**
 * this is body we will send back to the client ie SLUad
 */
export interface ChatResponse {
  /// this is the output exactl as we get it from OpenAI
  output?: Array<ResponseOutputItem>;
  /// this is directly the output_text from OpenAI
  output_text: string;
  metadata: {
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
  };
  id?: string;
}
export type ResponseOutputItem = ResponseOutputMessage | ResponseFunctionToolCall | ResponseOutputText | ResponseOutputRefusal;
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
