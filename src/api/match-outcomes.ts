import { apiFetch } from './client';

export type ReportableOutcome = 'A' | 'B' | 'DRAW';

export function reportOutcome(matchId: string, outcome: ReportableOutcome) {
  return apiFetch<{ officialOutcome: 'A' | 'B' | 'DRAW' | null }>(
    `/matches/${matchId}/outcome-report`,
    { method: 'POST', body: { outcome } },
  );
}
