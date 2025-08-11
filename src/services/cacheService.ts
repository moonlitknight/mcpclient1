import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const chatHistoryCache = new Map<string, ChatCompletionMessageParam[]>();

export function getHistory(userId: string): ChatCompletionMessageParam[] {
  return chatHistoryCache.get(userId) || [];
}

export function updateHistory(userId: string, history: ChatCompletionMessageParam[]) {
  chatHistoryCache.set(userId, history);
}

export function clearHistory(userId: string) {
  chatHistoryCache.delete(userId);
}
