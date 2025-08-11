import request from 'supertest';
import { createApp } from './server';
import { initializeConfig, Config } from './config';
import * as openaiService from './services/openaiService';
import * as supabaseService from './services/supabaseService';

process.env.OPENAI_KEY = 'dummy-key';
jest.mock('./services/openaiService');
jest.mock('./services/supabaseService');

const mockedOpenaiService = openaiService as jest.Mocked<typeof openaiService>;
const mockedSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;

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
    it('should return 200 OK for a valid request', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
      mockedOpenaiService.processChat.mockResolvedValue('Test response');

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Test response');
      expect(mockedOpenaiService.processChat).toHaveBeenCalledWith('Hello', config);
    });

    it('should return 400 for a request with missing text', async () => {
      const res = await request(app)
        .post('/chat')
        .send({ supabase_jwt: 'valid.jwt.token' });

      expect(res.status).toBe(400);
    });

    it('should return 401 for a request with an invalid JWT', async () => {
      mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(false);

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'invalid.jwt.token' });

      expect(res.status).toBe(401);
    });

    it('should return 500 if openaiService fails', async () => {
        mockedSupabaseService.validateSupabaseJWT.mockResolvedValue(true);
        mockedOpenaiService.processChat.mockRejectedValue(new Error('OpenAI error'));

        const res = await request(app)
          .post('/chat')
          .send({ text: 'Hello', supabase_jwt: 'valid.jwt.token' });

        expect(res.status).toBe(500);
      });

    it('should bypass JWT validation for "test" jwt', async () => {
      mockedOpenaiService.processChat.mockResolvedValue('Test response');

      const res = await request(app)
        .post('/chat')
        .send({ text: 'Hello', supabase_jwt: 'test' });

      expect(res.status).toBe(200);
      expect(mockedSupabaseService.validateSupabaseJWT).not.toHaveBeenCalled();
    });
  });
});
