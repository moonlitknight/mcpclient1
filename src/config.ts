import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface Config {
  httpPort: number;
  openaiKey: string;
  llmTemperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseProjectRef: string;
  systemPrompt: string;
  model: string;
}

let config: Config =
{
  httpPort: 3001,
  openaiKey: '',
  llmTemperature: 0.66,
  maxTokens: 150,
  topP: 1.0,
  presencePenalty: 0.0,
  frequencyPenalty: 0.0,
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseProjectRef: '',
  systemPrompt: 'You are a helpful assistant.',
  model: 'gpt-3.5-turbo'
};

export async function initializeConfig(): Promise<Config> {
  // Load .env file
  dotenv.config();

  // Load MCP config
  const mcpConfigPath = path.join(process.cwd(), '.mcp_config.json');
  let mcpConfig: any = {};

  if (fs.existsSync(mcpConfigPath)) {
    mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
  }

  try {
    const supabaseEnv = mcpConfig.mcpServers?.supabase?.env || {};
    config.httpPort = parseInt(process.env.HTTP_PORT || '3001');
    config.openaiKey = process.env.OPENAI_KEY || '';
    config.llmTemperature = parseFloat(process.env.LLM_TEMPERATURE || '0.66');
    config.maxTokens = parseInt(process.env.MAX_TOKENS || '150');
    config.topP = parseFloat(process.env.TOP_P || '1.0');
    config.presencePenalty = parseFloat(process.env.PRESENCE_PENALTY || '0.0');
    config.frequencyPenalty = parseFloat(process.env.FREQUENCY_PENALTY || '0.0');
    config.model = process.env.MODEL || 'gpt-3.5-turbo';
    config.supabaseUrl = supabaseEnv.DATABASE_URL || '';
    config.supabaseAnonKey = supabaseEnv.SUPABASE_ANON_KEY || '';
    config.supabaseProjectRef = supabaseEnv.SUPABASE_PROJECT_REF || '';

    // Load system prompt
    const systemPromptPath = path.join(process.cwd(), '.system_prompt');
    if (fs.existsSync(systemPromptPath)) {
      config.systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');
    }

    // Validate required config
    if (!config.openaiKey) {
      throw new Error('OPENAI_KEY is required in .env');
    }
    if (!config.supabaseUrl) {
      throw new Error('DATABASE_URL is required in .mcp_config.json');
    }
    if (!config.supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY is required in .mcp_config.json');
    }
    if (!config.supabaseProjectRef) {
      throw new Error('SUPABASE_PROJECT_REF is required in .mcp_config.json');
    }

    logger.info('Configuration initialized');
    return config;
  } catch (error) {
    logger.error('Failed to load MCP configuration:', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuration not initialized');
  }
  return config;
}
