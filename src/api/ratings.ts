import { apiFetch } from './client';

export type SubmitRatingPayload = {
  rateeUserId: string;
  performance: number;
  respect: number;
  sportsmanship: number;
  swearing: number;
  aggression: number;
  punctuality: number;
};

export type SubmitRatingResponse = {
  id: string;
  editCount: number;
  editsLeft: number;
  rateePositionAtMatch: string;
};

export type MyRatingVote = SubmitRatingPayload & {
  id: string;
  rateePositionAtMatch: string;
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
