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
