import request from 'supertest';
import { createApp } from './server';
import { initializeConfig, Config } from './config';
import * as supabaseService from './services/supabaseService';
import { jwtDecode } from 'jwt-decode';
import { clearAllHistory } from './services/cacheService';
import * as openaiClient from './services/openaiClient';

process.env.OPENAI_KEY = 'dummy-key';

jest.mock('./services/supabaseService');
jest.mock('jwt-decode');
jest.mock('./services/openaiClient', () => ({
  getOpenAIClient: jest.fn(),
  __resetOpenAIClient: jest.fn(),
}));

const mockedSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockedJwtDecode = jwtDecode as jest.Mock;
const mockedGetOpenAIClient = openaiClient.getOpenAIClient as jest.Mock;
const mockedResetOpenAIClient = openaiClient.__resetOpenAIClient as jest.Mock;

describe('Server', () => {
  let app: any;
  let config: Config;
  const mockCreate = jest.fn();

  beforeAll(async () => {
    config = await initializeConfig();
    app = createApp(config);
  });

  beforeEach(() => {
    const mockClient = {
      responses: {
        create: mockCreate,
      },
    };
    mockedGetOpenAIClient.mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /chat', () => {
    it('should return 200 OK for a valid request', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      mockCreate.mockResolvedValue({ output_text: 'Test response' });
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Test response');
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.arrayContaining([
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

    it('should use the provided string as userId if JWT is invalid', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(false);
      mockCreate.mockResolvedValue({ output_text: 'Test response' });

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'not-a-jwt' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Test response');
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' })
        ])
      }));
    });

    it('should return 500 if openaiService fails', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      mockCreate.mockRejectedValue(new Error('OpenAI error'));
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(500);
    });

    it('should use the temperature from the request body', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      mockCreate.mockResolvedValue({ output_text: 'Test response' });
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      const overrideTemperature = 0.99;
      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token', temperature: overrideTemperature });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Test response');
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: overrideTemperature
      }));
    });

    it('should maintain conversation history', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      mockedJwtDecode.mockReturnValue({ email: 'test@example.com' });

      // First request
      mockCreate.mockResolvedValueOnce({
        output_text: 'Response 1',
      });
      await request(app)
        .post('/chat')
        .send({ text: 'Request 1', supabase_jwt: 'valid.jwt.token' });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: 'Request 1' }
        ]
      }));

      // Second request
      mockCreate.mockResolvedValueOnce({
        output_text: 'Response 2'
      });
      await request(app)
        .post('/chat')
        .send({ text: 'Request 2', supabase_jwt: 'valid.jwt.token' });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        input: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: 'Request 1' },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: 'Request 2' }
        ]
      }));
    });
  });
});
