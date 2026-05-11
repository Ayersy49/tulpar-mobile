import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../auth/store';

// socket.io connects at the root namespace ('/'), NOT under /api/v1.
// Mounting it under the API prefix would 404 the engine.io handshake.

let socket: Socket | null = null;
let socketToken: string | null = null;

function teardown() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
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

/**
 * Subscribe to live slot updates AND cancellation for a match. Returns an
 * unsubscribe function that should be called from the screen's cleanup.
 *
 * Fires `onChange` for every `match:slot_update` (join/leave/promote) AND
 * every `match:cancelled` event. Consumers treat it as a hint to refetch
 * canonical detail — keeps a single source of truth and avoids local slot
 * reconciliation logic.
 *
 * Uses `.on('connect', ...)` (not `.once`) so a transient disconnect followed
 * by socket.io's auto-reconnect re-emits the room subscribe. Otherwise the
 * second WS session would be silent until the user manually navigated away
 * and back.
 */
export function subscribeToMatch(
  matchId: string,
  onChange: () => void,
): () => void {
  const s = getSocket();
  if (!s) return () => {};

  const subscribe = () => {
    s.emit('match:subscribe', { matchId });
  };

  if (s.connected) {
    subscribe();
  }
  // Always register so reconnects after a flap re-subscribe.
  s.on('connect', subscribe);

  const handler = () => onChange();
  s.on('match:slot_update', handler);
  s.on('match:cancelled', handler);

  return () => {
    s.off('match:slot_update', handler);
    s.off('match:cancelled', handler);
    s.off('connect', subscribe);
    if (s.connected) {
      s.emit('match:unsubscribe', { matchId });
    }
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
