// matchfinder-mobile/src/api/users.ts
import { apiFetch } from './client';
import type { Position } from './me';

export type PublicUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  district: string | null;
  position1: Position | null;
  position2: Position | null;
  position3: Position | null;
};

export function getPublicUser(userId: string): Promise<PublicUser> {
  return apiFetch<PublicUser>(`/users/${userId}/public`);
}

export type WdlResult = {
  matchId: string;
  playedAt: string;
  seriesTitle: string | null;
  // myTeam can be null in pathological data (participant present but slot
  // missing); the W/D/L strip skips rendering when it happens.
  myTeam: 'A' | 'B' | null;
  outcome: 'A' | 'B' | 'DRAW';
  result: 'W' | 'D' | 'L';
};

export type UserWdl = {
  userId: string;
  results: WdlResult[];
  summary: { wins: number; draws: number; losses: number };
};

export function getWdl(userId: string): Promise<UserWdl> {
  return apiFetch<UserWdl>(`/users/${userId}/wdl`);
}
