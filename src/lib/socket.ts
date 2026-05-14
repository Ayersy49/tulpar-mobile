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
 * Subscribe to live updates for a match (slot changes, cancellation,
 * P2.M1 lifecycle state transitions, and scheduledAt postpone/forward
 * changes). Returns an unsubscribe fn for cleanup.
 *
 * Fires `onChange` for every `match:slot_update` (join/leave/promote),
 * every `match:cancelled`, every `match:state_change`, AND every
 * `match:updated` event. Consumers treat it as a hint to refetch canonical
 * detail — keeps a single source of truth and avoids local reconciliation.
 *
 * `match:state_change` is emitted by the backend LifecycleService cron when
 * a match transitions OPEN/LOCKED → LIVE → RATING_WINDOW → CLOSED. Mobile
 * just refetches; the detail formatter exposes the new state + derived
 * `liveAt` / `ratingWindowOpensAt` / `ratingWindowClosesAt` timestamps.
 *
 * `match:updated` is emitted by `MatchesService.update()` whenever
 * `scheduledAt` changes in either direction (postpone or move forward).
 * Mobile refetches so the detail header reflects the new time without a
 * pull-to-refresh.
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

  // socket.io listeners are scoped to the socket, not the room — a socket
  // joined to two match rooms receives both rooms' events. Filter by matchId
  // (backend stamps every match-room payload via WsGateway.emitToMatch).
  const handler = (payload: unknown) => {
    if (
      payload &&
      typeof payload === 'object' &&
      (payload as { matchId?: string }).matchId !== matchId
    ) {
      return;
    }
    onChange();
  };
  s.on('match:slot_update', handler);
  s.on('match:cancelled', handler);
  s.on('match:state_change', handler);
  s.on('match:updated', handler);

  return () => {
    s.off('match:slot_update', handler);
    s.off('match:cancelled', handler);
    s.off('match:state_change', handler);
    s.off('match:updated', handler);
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
  matchId: string;
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

  // Filter by matchId — same reason as subscribeToMatch's handler.
  const handler = (payload: ChatMessageEvent) => {
    if (payload?.matchId !== matchId) return;
    onMessage(payload);
  };
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
