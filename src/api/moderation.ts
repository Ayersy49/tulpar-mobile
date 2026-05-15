// matchfinder-mobile/src/api/moderation.ts
import { apiFetch } from './client';

export type ReportReason =
  | 'TOXICITY'
  | 'AGGRESSION'
  | 'PROFANITY'
  | 'NO_SHOW'
  | 'CHEATING'
  | 'HARASSMENT'
  | 'OTHER';

export const REPORT_REASONS: readonly ReportReason[] = [
  'TOXICITY',
  'AGGRESSION',
  'PROFANITY',
  'NO_SHOW',
  'CHEATING',
  'HARASSMENT',
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
