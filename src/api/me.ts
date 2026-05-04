import { apiFetch } from './client';

export const POSITIONS = [
  'GK',
  'RB',
  'RCB',
  'LCB',
  'LB',
  'RWB',
  'LWB',
  'CDM',
  'CM',
  'CAM',
  'RW',
  'LW',
  'ST',
  'SS',
] as const;

export type Position = (typeof POSITIONS)[number];

export type MeProfile = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  district: string | null;
  dateOfBirth: string | null;
  height: number | null;
  weight: number | null;
  position1: Position | null;
  position2: Position | null;
  position3: Position | null;
  discoverable: boolean;
  onboardingDone: boolean;
  usernameChangesLeft: number;
};

export type MeResponse = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  profile: MeProfile | null;
};

export type UpdateProfilePayload = Partial<{
  username: string;
  firstName: string;
  lastName: string;
  city: string;
  district: string;
  dateOfBirth: string;
  height: number;
  weight: number;
  position1: Position;
  position2: Position;
  position3: Position;
}>;

export function getMe() {
  return apiFetch<MeResponse>('/me');
}

export function updateMyProfile(payload: UpdateProfilePayload) {
  return apiFetch<MeProfile>('/me/profile', {
    method: 'PATCH',
    body: payload,
  });
}
