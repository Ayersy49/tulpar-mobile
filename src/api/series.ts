import { apiFetch } from './client';

export type SeriesTeamMode = 'MIXED' | 'FIXED';
export type SeriesStatus = 'ACTIVE' | 'PAUSED';
export type SeriesInstanceState =
  | 'OPEN_RSVP'
  | 'LOCKED'
  | 'LIVE'
  | 'RATING_WINDOW'
  | 'CLOSED'
  | 'CANCELLED';

export type SeriesSummary = {
  seriesId: string;
  title: string;
  status: SeriesStatus;
  teamMode: SeriesTeamMode;
  // listSeriesForUser returns the full upcoming-instance row when one exists
  // (state == OPEN_RSVP, take: 1). We narrow to the fields the list screen
  // actually shows — additional fields are present at runtime but unused.
  nextInstance: {
    id: string;
    scheduledAt: string;
    state: SeriesInstanceState;
  } | null;
  hiddenAt: string | null;
};

export type SeriesMemberSummary = {
  id: string;
  userId: string;
  hiddenAt: string | null;
  user: {
    id: string;
    profile: {
      username: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
};

export type SeriesTeam = {
  id: string;
  name: string;
  colorHex: string;
  members: Array<{ userId: string }>;
};

export type SeriesUpcomingMatch = {
  id: string;
  scheduledAt: string;
  state: SeriesInstanceState;
  seriesWeekIndex: number | null;
};

export type SeriesDetail = {
  id: string;
  title: string;
  dayOfWeek: number;
  timeOfDay: string;
  durationMin: number;
  city: string | null;
  district: string | null;
  difficulty: string | null;
  pricePerPlayer: number | null;
  teamMode: SeriesTeamMode;
  status: SeriesStatus;
  authorityAId: string;
  authorityBId: string | null;
  creatorId: string;
  authorityFormatOverride: number | null;
  members: SeriesMemberSummary[];
  teams: SeriesTeam[];
  matches: SeriesUpcomingMatch[];
};

export type CreateSeriesPayload = {
  title: string;
  dayOfWeek: number;
  timeOfDay: string;
  durationMin: number;
  city?: string;
  district?: string;
  difficulty?: string;
  pricePerPlayer?: number;
  teamMode: SeriesTeamMode;
  teams?: Array<{ name: string; colorHex: string }>;
};

export type UpdateSeriesPayload = Partial<
  Omit<CreateSeriesPayload, 'teamMode' | 'teams'>
>;

export function listSeries(includeHidden = false) {
  const qs = includeHidden ? '?includeHidden=true' : '';
  return apiFetch<SeriesSummary[]>(`/series${qs}`);
}

export function getSeries(id: string) {
  return apiFetch<SeriesDetail>(`/series/${id}`);
}

export function createSeries(payload: CreateSeriesPayload) {
  return apiFetch<{ id: string }>('/series', { method: 'POST', body: payload });
}

export function updateSeries(id: string, payload: UpdateSeriesPayload) {
  return apiFetch<SeriesDetail>(`/series/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function pauseSeries(id: string) {
  return apiFetch(`/series/${id}/pause`, { method: 'POST' });
}

export function resumeSeries(id: string) {
  return apiFetch(`/series/${id}/resume`, { method: 'POST' });
}

export function skipNextWeek(id: string) {
  return apiFetch(`/series/${id}/skip-next`, { method: 'POST' });
}

export function transferAuthority(
  id: string,
  slot: 'A' | 'B',
  toUserId: string,
) {
  return apiFetch(`/series/${id}/transfer-authority`, {
    method: 'POST',
    body: { slot, toUserId },
  });
}

export function hideSeries(id: string) {
  return apiFetch(`/series/${id}/hide`, { method: 'POST' });
}

export function unhideSeries(id: string) {
  return apiFetch(`/series/${id}/unhide`, { method: 'POST' });
}
