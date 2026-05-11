import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../auth/store';

// socket.io connects at the root namespace ('/'), NOT under /api/v1.
// Mounting it under the API prefix would 404 the engine.io handshake.

let socket: Socket | null = null;
let socketToken: string | null = null;

// Ref-count per matchId so multiple screens (detail + chat) can share the
// same match-room subscription. Without this, the unmount of one screen would
// call `match:unsubscribe` and silently kick the still-mounted screen out of
// the room, killing its live updates.
const matchRoomRefCount = new Map<string, number>();

function teardown() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
    matchRoomRefCount.clear();
  }
}

function getSocket(): Socket | null {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    teardown();
    return null;
  }

  // Token changed (refresh) or socket was torn down — recreate.
  if (!socket || socketToken !== token) {
    teardown();
    socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketToken = token;
  }
  return socket;
}

// Internal helpers that own the match-room ref counting. Every consumer that
// wants live events for a match calls `acquireMatchRoom`; the corresponding
// `releaseMatchRoom` only emits `match:unsubscribe` when the last consumer
// drops out. The `connect` handler is also shared so reconnects rejoin once.
function acquireMatchRoom(s: Socket, matchId: string): () => void {
  const current = matchRoomRefCount.get(matchId) ?? 0;
  matchRoomRefCount.set(matchId, current + 1);

  const subscribe = () => {
    s.emit('match:subscribe', { matchId });
  };

  if (current === 0) {
    if (s.connected) subscribe();
    s.on('connect', subscribe);
  }

  return () => {
    const remaining = (matchRoomRefCount.get(matchId) ?? 1) - 1;
    if (remaining <= 0) {
      matchRoomRefCount.delete(matchId);
      s.off('connect', subscribe);
      if (s.connected) {
        s.emit('match:unsubscribe', { matchId });
      }
    } else {
      matchRoomRefCount.set(matchId, remaining);
    }
  };
}

/**
 * Subscribe to live slot updates AND cancellation for a match. Returns an
 * unsubscribe function that should be called from the screen's cleanup.
 *
 * Fires `onChange` for every `match:slot_update` (join/leave/promote) AND
 * every `match:cancelled` event. Consumers treat it as a hint to refetch
 * canonical detail — keeps a single source of truth and avoids local slot
 * reconciliation logic.
 *
 * Match-room subscription is ref-counted so the detail screen and chat
 * screen can both subscribe; only the last release emits `match:unsubscribe`.
 */
export function subscribeToMatch(
  matchId: string,
  onChange: () => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const releaseRoom = acquireMatchRoom(s, matchId);

  const handler = () => onChange();
  s.on('match:slot_update', handler);
  s.on('match:cancelled', handler);

  return () => {
    s.off('match:slot_update', handler);
    s.off('match:cancelled', handler);
    releaseRoom();
  };
}

/**
 * Chat-specific subscription. Joins the match room (ref-counted, shared with
 * `subscribeToMatch`) and registers a listener for `chat:message` broadcasts.
 *
 * The payload is the full message object (id, content, isSystem, createdAt,
 * user). Consumers append it to their local message list and dedup by id
 * (the WS echo also fires for the sender, so optimistic local copies need to
 * be reconciled by id).
 */
export type ChatMessageEvent = {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  user: { userId: string; username: string | null };
};

export function subscribeToMatchChat(
  matchId: string,
  onMessage: (msg: ChatMessageEvent) => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const releaseRoom = acquireMatchRoom(s, matchId);

  const handler = (payload: ChatMessageEvent) => onMessage(payload);
  s.on('chat:message', handler);

  return () => {
    s.off('chat:message', handler);
    releaseRoom();
  };
}

/**
 * Subscribe to user-room events fired to the authenticated viewer's own
 * socket room. The backend gateway auto-joins `user:${userId}` on connect,
 * so no additional emit is needed — we just register listeners.
 *
 * Used by M4.B for `match:request_created` so the organizer's pending
 * panel updates live without pull-to-refresh. Returns an unsubscribe fn.
 *
 * Same WS-as-hint pattern as `subscribeToMatch`: the handler is called for
 * every matching event but the payload is intentionally typed as `unknown`
 * — consumers should treat it as a refetch trigger, not authoritative data.
 */
export function subscribeToUserEvents(
  event: string,
  onEvent: (payload: unknown) => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on(event, onEvent);
  return () => {
    s.off(event, onEvent);
  };
}

/**
 * Tear down the socket on logout. Called from the auth store's signOut path
 * (or any place that clears tokens) so we don't leak a connection authed
 * with a stale token.
 */
export function disconnectSocket() {
  teardown();
}

// Drop the connection when the user signs out so the next session doesn't
// reuse a socket bound to the previous (now-revoked) token.
useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) {
    teardown();
  }
});
