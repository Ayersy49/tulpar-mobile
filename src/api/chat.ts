import { apiFetch } from './client';

export type ChatMessage = {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  user: { userId: string; username: string | null };
};

export type ChatPage = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

export type ListChatQuery = {
  cursor?: string;
  limit?: number;
};

function buildQuery(q: ListChatQuery): string {
  const params = new URLSearchParams();
  if (q.cursor) params.set('cursor', q.cursor);
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function listMessages(matchId: string, query: ListChatQuery = {}) {
  return apiFetch<ChatPage>(`/matches/${matchId}/chat${buildQuery(query)}`);
}

export function sendMessage(matchId: string, content: string) {
  return apiFetch<ChatMessage>(`/matches/${matchId}/chat`, {
    method: 'POST',
    body: { content },
  });
}
