export interface ChatRequest {
  text: string;
  supabase_jwt: string;
  temperature?: number;
}

export interface ChatResponse {
  response: string;
  metadata: {
    timestamp: string;
    status: 'success' | 'error';
    error?: string;
  };
}
