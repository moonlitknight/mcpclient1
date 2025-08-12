import OpenAI from 'openai';
import { getConfig } from '../config';

let client: OpenAI | undefined;

function createOpenAIClient() {
  const config = getConfig();
  if (!config.openaiKey) {
    // This check is important for the actual application run
    throw new Error("OpenAI API key not configured. Please set OPENAI_KEY environment variable.");
  }
  return new OpenAI({
    apiKey: config.openaiKey,
  });
}

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = createOpenAIClient();
  }
  return client;
}

// This function is for testing purposes, to allow resetting the singleton
export function __resetOpenAIClient() {
  client = undefined;
}
