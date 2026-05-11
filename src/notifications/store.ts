import { create } from 'zustand';
import { useAuthStore } from '../auth/store';

type NotificationsState = {
  unreadCount: number;
  // Seed from a GET /notifications response. Replaces the current count
  // entirely so a fresh server fetch is the source of truth on remount.
  setUnread: (n: number) => void;
  // Increment by 1 — used by the WS `notification` listener on push.
  bumpUnread: () => void;
  // Decrement by 1 — used after a single mark-read.
  decrementUnread: () => void;
  // Zero it out — used after mark-all-read or signOut.
  clearUnread: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unreadCount: 0,
  setUnread: (n) => set({ unreadCount: Math.max(0, n) }),
  bumpUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: () =>
    set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  clearUnread: () => set({ unreadCount: 0 }),
}));

// Clear the unread badge on logout so the next user doesn't inherit it.
useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) {
    useNotificationsStore.getState().clearUnread();
  }
});
