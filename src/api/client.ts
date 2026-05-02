import { apiUrl } from '../config';
import { useAuthStore } from '../auth/store';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, setTokens, signOut } = useAuthStore.getState();
    if (!refreshToken) {
      await signOut();
      return null;
    }

    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await signOut();
        return null;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      await signOut();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function doFetch(path: string, options: FetchOptions, accessToken: string | null) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.auth !== false && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(apiUrl(path), {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  let res = await doFetch(path, options, accessToken);

  if (res.status === 401 && options.auth !== false) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(path, options, newToken);
    }
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Request failed: ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}
