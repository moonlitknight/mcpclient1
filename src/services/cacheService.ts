import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/// keyed by userID which is a string typically an email address
const chatHistoryCache = new Map<string, ChatCompletionMessageParam[]>();
const developerPromptCache = new Map<string, string>();
const responseIdCache = new Map<string, string>();

export function setDeveloperPrompt(userId: string, developerPrompt: string) {
  developerPromptCache.set(userId, developerPrompt);
}

export function getDeveloperPrompt(userId: string): string {
  return developerPromptCache.get(userId) || '';
}

export function getHistory(userId: string): ChatCompletionMessageParam[] {
  return chatHistoryCache.get(userId) || [];
}

export function updateHistory(userId: string, history: ChatCompletionMessageParam[]) {
  chatHistoryCache.set(userId, history);
}

export function getPreviousResponseId(userId: string): string | undefined {
  return responseIdCache.get(userId);
}

export function updatePreviousResponseId(userId: string, responseId: string) {
  responseIdCache.set(userId, responseId);
}

export function clearHistory(userId: string): ChatCompletionMessageParam[] {
  chatHistoryCache.delete(userId);
  responseIdCache.delete(userId);
  return getHistory(userId);
}

export function clearAllHistory() {
  chatHistoryCache.clear();
  responseIdCache.clear();
}
