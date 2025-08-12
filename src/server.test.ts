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

  describe('POST /chat', () => {
    it('should stream the response for a valid request', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      const chunks: OpenAI.Chat.Completions.ChatCompletionChunk[] = [
        { id: '1', choices: [{ delta: { content: 'Hello ' }, index: 0, finish_reason: 'length', logprobs: undefined }], created: 1, model: '', object: 'chat.completion.chunk', system_fingerprint: undefined },
        { id: '2', choices: [{ delta: { content: 'World' }, index: 0, finish_reason: 'stop', logprobs: undefined }], created: 1, model: '', object: 'chat.completion.chunk', system_fingerprint: undefined },
      ];
      const mockCreate = jest.fn().mockResolvedValue(mockStream(chunks));
      mockedGetOpenAIClient.mockReturnValue({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any);
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      const req = request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

      const res = await new Promise<any>((resolve) => {
        request(app)
          .post('/chat')
          .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' })
          .end((err, res) => {
            resolve(res);
          });
      });

      expect(res.status).toBe(200);
      expect(res.text).toBe('{"response":"Hello "}{"response":"World"}');
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        stream: true,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' })
        ])
      }));
    });

    it('should return 400 for a request with missing text', async () => {
      const res = await request(app)
        .post('/chat')
        .send({ supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(400);
    });

    it('should return 500 if openaiService fails', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      const mockCreate = jest.fn().mockRejectedValue(new Error('OpenAI error'));
      mockedGetOpenAIClient.mockReturnValue({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any);
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(500);
    });
  });
});
