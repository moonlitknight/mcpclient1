import { OpenAI } from "openai";

export interface ChatRequest {
  text: string;
  supabase_jwt: string;
  temperature?: number;
  stream?: boolean;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
}

export interface ChatResponse {
  response: string;
  metadata: {
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
  };
}
