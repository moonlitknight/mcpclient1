import request from 'supertest';
import { createApp } from './server';
import { initializeConfig, Config } from './config';
import * as supabaseService from './services/supabaseService';
import { jwtDecode } from 'jwt-decode';
import * as openaiClient from './services/openaiClient';
import { OpenAI } from 'openai';

process.env.OPENAI_KEY = 'dummy-key';

jest.mock('./services/supabaseService');
jest.mock('jwt-decode');
jest.mock('./services/openaiClient');

const mockedSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockedJwtDecode = jwtDecode as jest.Mock;
const mockedGetOpenAIClient = openaiClient.getOpenAIClient as jest.Mock;

// Mock async generator for streaming
async function* mockStream(chunks: OpenAI.Chat.Completions.ChatCompletionChunk[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('Server', () => {
  let app: any;
  let config: Config;

  beforeAll(async () => {
    config = await initializeConfig();
    app = createApp(config);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });
});
