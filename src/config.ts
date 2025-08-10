import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface Config {
  httpPort: number;
  openaiKey: string;
  llmTemperature: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseProjectRef: string;
}

let config: Config =
{
  httpPort: 3001,
  openaiKey: '',
  llmTemperature: 0.66,
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseProjectRef: ''
};

export async function initializeConfig(): Promise<Config> {
  let config: Config =
  {
    httpPort: 3001,
    openaiKey: '',
    llmTemperature: 0.66,
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseProjectRef: ''
  };
  // Load .env file
  dotenv.config();

  // Load MCP config
  const mcpConfigPath = path.join(process.cwd(), '.mcp_config.json');
  let mcpConfig = {
    mcpServers: {
      supabase: {
        env: {}
      }
    }
  };

  if (fs.existsSync(mcpConfigPath)) {
    mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
  }

  try {
    const supabaseEnv = mcpConfig.mcpServers?.supabase?.env || {};
    config = {
      httpPort: parseInt(process.env.HTTP_PORT || '3001'),
      openaiKey: process.env.OPENAI_KEY || '',
      llmTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0.66'),
      supabaseUrl: '',
      supabaseAnonKey: '',
      supabaseProjectRef: ''
    };

    // Validate required config
    if (!config.openaiKey) {
      throw new Error('OPENAI_KEY is required in .env');
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
