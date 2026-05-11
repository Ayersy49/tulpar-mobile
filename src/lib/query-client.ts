import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Drop all cached data when the user signs out. Without this, the next user
// who logs in on the same device would see the previous account's cached
// match details / profile / requests until staleTime elapses — that's both a
// privacy issue and a "why do I need to pull-to-refresh" bug. Mirrors the
// socket teardown in src/lib/socket.ts, which also subscribes to this store.
useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) {
    queryClient.clear();
  }
});
