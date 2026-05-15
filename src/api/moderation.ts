// matchfinder-mobile/src/api/moderation.ts
import { apiFetch } from './client';

export type ReportReason =
  | 'CHAT_SWEARING'
  | 'CHAT_TOXICITY'
  | 'CHAT_TROLLING'
  | 'GAME_SWEARING'
  | 'GAME_AGGRESSION'
  | 'GAME_INSULT'
  | 'NO_SHOW'
  | 'RANK_CHEATING'
  | 'OTHER';

export const REPORT_REASONS: readonly ReportReason[] = [
  'CHAT_SWEARING',
  'CHAT_TOXICITY',
  'CHAT_TROLLING',
  'GAME_SWEARING',
  'GAME_AGGRESSION',
  'GAME_INSULT',
  'NO_SHOW',
  'RANK_CHEATING',
  'OTHER',
] as const;

export type ReportPlayerPayload = {
  reportedUserId: string;
  reason: ReportReason;
  matchId?: string;
  notes?: string;
};

export type ReportPlayerResponse = {
  id: string;
};

export function reportPlayer(
  payload: ReportPlayerPayload,
  opts: { idempotencyKey: string },
): Promise<ReportPlayerResponse> {
  return apiFetch<ReportPlayerResponse>('/reports/players', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': opts.idempotencyKey },
  });
}
