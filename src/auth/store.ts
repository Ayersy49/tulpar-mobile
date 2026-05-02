import { create } from 'zustand';
import { clearTokens, loadTokens, saveTokens } from './storage';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: async () => {
    const { accessToken, refreshToken } = await loadTokens();
    set({ accessToken, refreshToken, hydrated: true });
  },

  setTokens: async (accessToken, refreshToken) => {
    await saveTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken });
  },

  signOut: async () => {
    await clearTokens();
    set({ accessToken: null, refreshToken: null });
  },
}));
