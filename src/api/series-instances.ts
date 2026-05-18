import { apiFetch } from './client';

export type RsvpStatus = 'COMING' | 'NOT_COMING' | 'NO_ANSWER';

export function submitRsvp(matchId: string, status: 'COMING' | 'NOT_COMING') {
  return apiFetch(`/series-instances/${matchId}/rsvp`, {
    method: 'POST',
    body: { status },
  });
}

export function setFormatOverride(matchId: string, format: number | null) {
  // Backend treats omitted `format` as "clear override". Sending `null`
  // explicitly clears it for symmetry with the mobile UI's "Sistemin seçimini
  // kullan" option.
  return apiFetch(`/series-instances/${matchId}/format-override`, {
    method: 'POST',
    body: { format },
  });
}

export type SeriesTeamMode = 'MIXED' | 'FIXED';

export function setTeamModeOverride(
  matchId: string,
  mode: SeriesTeamMode | null,
) {
  // null clears any prior override; the lock cron then falls back to
  // series.teamMode. FIXED override on a MIXED series is rejected with 400
  // — the UI hides the picker for MIXED series to avoid the dead end.
  return apiFetch(`/series-instances/${matchId}/team-mode-override`, {
    method: 'POST',
    body: { mode },
  });
}

export function listPublicly(matchId: string) {
  return apiFetch(`/series-instances/${matchId}/list-publicly`, {
    method: 'POST',
  });
}

export function unlistPublicly(matchId: string) {
  return apiFetch(`/series-instances/${matchId}/unlist-publicly`, {
    method: 'POST',
  });
}

export function skipInstance(matchId: string) {
  return apiFetch(`/series-instances/${matchId}/skip`, { method: 'POST' });
}

export function forceLock(matchId: string) {
  return apiFetch(`/series-instances/${matchId}/force-lock`, {
    method: 'POST',
  });
}

export function sendManualReminder(matchId: string) {
  return apiFetch(`/series-instances/${matchId}/manual-reminder`, {
    method: 'POST',
  });
}

export type LineupEntry = {
  userId: string;
  team: 'A' | 'B';
  position: string | null;
  isReserve: boolean;
};

export function editLineup(matchId: string, lineup: LineupEntry[]) {
  return apiFetch(`/series-instances/${matchId}/lineup`, {
    method: 'PATCH',
    body: { lineup },
  });
}
