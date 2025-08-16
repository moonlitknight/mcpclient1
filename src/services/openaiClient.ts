/**
 * Module for managing OpenAI client instance.
 * @module openaiClient
 */

import OpenAI from 'openai';
import { getConfig } from '../config';

let client: OpenAI | undefined;

/**
 * Creates a new OpenAI client instance.
 * @function createOpenAIClient
 * @returns {OpenAI} The OpenAI client instance
 * @throws {Error} If OpenAI API key is not configured
 */
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

/**
 * Gets the singleton OpenAI client instance, creating it if needed.
 * @function getOpenAIClient
 * @returns {OpenAI} The OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = createOpenAIClient();
  }
  return client;
}

// This function is for testing purposes, to allow resetting the singleton
/**
 * Resets the OpenAI client singleton (for testing purposes).
 * @function __resetOpenAIClient
 */
export function __resetOpenAIClient() {
  client = undefined;
}
