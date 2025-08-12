export interface ChatRequest {
  text: string;
  supabase_jwt: string;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  response: string;
  metadata: {
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
  };
}
