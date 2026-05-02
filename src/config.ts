const rawBase = process.env.EXPO_PUBLIC_API_URL;

if (!rawBase) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set the backend URL.',
  );
}

export const API_BASE_URL = rawBase.replace(/\/$/, '');
export const API_PREFIX = '/api/v1';
export const apiUrl = (path: string) => `${API_BASE_URL}${API_PREFIX}${path}`;
