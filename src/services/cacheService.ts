import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const chatHistoryCache = new Map<string, ChatCompletionMessageParam[]>();
const responseIdCache = new Map<string, string>();

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

export function clearHistory(userId: string) {
  chatHistoryCache.delete(userId);
  responseIdCache.delete(userId);
}

export function clearAllHistory() {
  chatHistoryCache.clear();
  responseIdCache.clear();
}
