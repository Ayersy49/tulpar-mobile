import { apiFetch } from './client';
import type { Position } from './me';

/**
 * Each axis is optional (2026-05-14 product call): a rater can submit "just
 * Respect" for a player and leave the rest unset. Backend requires at least
 * one axis to be present per save. Edit count increments once per save,
 * regardless of how many axes the save touches.
 */
export type SubmitRatingPayload = {
  rateeUserId: string;
  performance?: number;
  respect?: number;
  sportsmanship?: number;
  swearing?: number;
  aggression?: number;
  punctuality?: number;
};

export type SubmitRatingResponse = {
  id: string;
  editCount: number;
  editsLeft: number;
  rateePositionAtMatch: string;
};

/**
 * Server-side a vote row can have any subset of axes filled in; fields are
 * `number | null` on the wire.
 */
export type MyRatingVote = {
  id: string;
  rateeUserId: string;
  rateePositionAtMatch: string;
  performance: number | null;
  respect: number | null;
  sportsmanship: number | null;
  swearing: number | null;
  aggression: number | null;
  punctuality: number | null;
  editCount: number;
  editsLeft: number;
};

export function submitRating(matchId: string, payload: SubmitRatingPayload) {
  return apiFetch<SubmitRatingResponse>(`/matches/${matchId}/ratings`, {
    method: 'POST',
    body: payload,
  });
}

export function getMyRatingsForMatch(matchId: string) {
  return apiFetch<MyRatingVote[]>(`/matches/${matchId}/ratings/me`);
}

export type UserRatingPosition = {
  position: Position;
  avgPerformance: number | null;
  matchCount: number;
  raterCount: number;
  display: number | '?';
};

export type UserRatingSportsmanship = {
  avgRespect: number | null;
  avgSportsmanship: number | null;
  avgSwearing: number | null;
  avgAggression: number | null;
  avgPunctuality: number | null;
  avgSiRaw: number | null;
  siDisplay: number | null;
  raterCount: number;
  voteCount: number;
  display: number | '?';
};

export type UserRatings = {
  userId: string;
  positions: UserRatingPosition[];
  sportsmanship: UserRatingSportsmanship | null;
};

export function getRatingsForUser(userId: string): Promise<UserRatings> {
  return apiFetch<UserRatings>(`/users/${userId}/ratings`);
}
