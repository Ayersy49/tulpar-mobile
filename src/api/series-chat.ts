import { apiFetch } from './client';

// Backend (SeriesChatController) paginates with `cursor` + `limit` and stores
// the message text under `content`. The payload mirrors per-match chat for
// continuity: nested `user.userId` rather than a flat author field.
export type SeriesChatMessage = {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  user: { userId: string; username: string | null };
};

export type SeriesChatPage = {
  messages: SeriesChatMessage[];
  nextCursor: string | null;
};

// `sendMessage` echoes the payload with the parent seriesId attached so the
// WS broadcast and the POST response share one shape. Mobile consumers can
// drop the seriesId when reconciling into a per-series message list.
export type SeriesChatBroadcast = SeriesChatMessage & { seriesId: string };

export function listSeriesChatMessages(
  seriesId: string,
  options: { cursor?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiFetch<SeriesChatPage>(
    `/series/${seriesId}/chat/messages${qs ? `?${qs}` : ''}`,
  );
}

export function sendSeriesChatMessage(seriesId: string, content: string) {
  return apiFetch<SeriesChatBroadcast>(
    `/series/${seriesId}/chat/messages`,
    { method: 'POST', body: { content } },
  );
}
