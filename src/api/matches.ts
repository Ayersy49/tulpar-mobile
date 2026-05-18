import { apiFetch } from './client';

export type MatchSummary = {
  id: string;
  type: string;
  state: 'OPEN' | 'LOCKED' | string;
  format: number;
  difficulty: string;
  isLocked: boolean;
  pricePerPerson: number | null;
  scheduledAt: string | null;
  pitchName: string | null;
  pitchAddress: string | null;
  city: string | null;
  district: string | null;
  createdBy: string;
  capacity: number;
  filled: number;
  capacityLabel: string;
  // S1C: classic-list rows expose the series-instance markers so the
  // SeriesBadge (navy "SERİ") can render on publicly-listed recurring rows.
  seriesId: string | null;
  seriesWeekIndex: number | null;
  isPubliclyListed: boolean;
};

export type MatchListResponse = {
  data: MatchSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type MatchListQuery = {
  city?: string;
  from?: string;
  to?: string;
  format?: number;
  difficulty?: string;
  maxPrice?: number;
  page?: number;
  limit?: number;
};

function buildQuery(q: MatchListQuery): string {
  const params = new URLSearchParams();
  if (q.city) params.set('city', q.city);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.format !== undefined) params.set('format', String(q.format));
  if (q.difficulty) params.set('difficulty', q.difficulty);
  if (q.maxPrice !== undefined) params.set('maxPrice', String(q.maxPrice));
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function listMatches(query: MatchListQuery = {}) {
  return apiFetch<MatchListResponse>(`/matches${buildQuery(query)}`, {
    auth: false,
  });
}

export type SlotPlayer =
  | { userId: string; username: string | null; joinedAt: string }
  | { occupied: true };

export type MatchSlot = {
  id: string;
  position: string;
  isReserve: boolean;
  sortOrder: number;
  player: SlotPlayer | null;
};

export type MyRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

export type MatchDetail = {
  id: string;
  type: string;
  state: string;
  format: number;
  difficulty: string;
  isLocked: boolean;
  isInviteOnly: boolean;
  pricePerPerson: number | null;
  scheduledAt: string | null;
  durationMin: number;
  // P2.M1: derived lifecycle timestamps from the backend so the UI can render
  // countdowns without re-deriving the rule. All ISO strings or null when
  // scheduledAt is null. ratingWindowOpensAt = scheduledAt + durationMin;
  // ratingWindowClosesAt = ratingWindowOpensAt + 24h.
  liveAt: string | null;
  ratingWindowOpensAt: string | null;
  ratingWindowClosesAt: string | null;
  pitchName: string | null;
  pitchLat: number | null;
  pitchLng: number | null;
  pitchAddress: string | null;
  city: string | null;
  district: string | null;
  createdBy: string;
  creatorId?: string;
  authorityId?: string;
  capacity: {
    playersPerTeam: number;
    reservesPerTeam: number;
    totalSlots: number;
    filled: number;
    label: string;
  };
  // M4.B: viewer's own join-request status, embedded so the requester UI
  // can render "İstek beklemede" persistently without an extra round trip.
  myRequestStatus: MyRequestStatus;
  // S1C: series-instance scalars. Always present; null when match is classic.
  seriesId: string | null;
  seriesWeekIndex: number | null;
  isPubliclyListed: boolean;
  outcomeSelectedUserIds: string[];
  officialOutcome: 'A' | 'B' | 'DRAW' | null;
  outcomeResolvedAt: string | null;
  // S1C: rich series envelope. Populated only when seriesId !== null; lets the
  // RSVP card, "Yönet" sheet, and OutcomeReportCard render from one round-trip.
  series: SeriesInstanceEnvelope | null;
  teamA: MatchSlot[];
  teamB: MatchSlot[];
};

export type SeriesInstanceEnvelope = {
  teamMode: 'MIXED' | 'FIXED' | null;
  // S1D: per-instance override of teamMode. Null means "fall back to teamMode".
  // The authority sheet picker reads (teamModeOverride ?? teamMode) as the
  // effective mode and only renders the picker when teamMode === 'FIXED'.
  teamModeOverride: 'MIXED' | 'FIXED' | null;
  isSeriesAuthority: boolean;
  authorityFormatOverride: number | null;
  rsvp: {
    counts: { coming: number; notComing: number; noAnswer: number };
    myStatus: 'COMING' | 'NOT_COMING' | null;
  };
  myOutcomeReport: { outcome: 'A' | 'B' | 'DRAW' } | null;
};

export type MatchRequest = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  preferredPosition: string | null;
  createdAt: string;
  user: {
    userId: string;
    username: string | null;
    positions: string[];
  };
};

export type MatchRequestCreatedEvent = {
  matchId: string;
  requestId: string;
  requester: {
    userId: string;
    username: string | null;
    positions: string[];
    preferredPosition: string | null;
  };
};

export function getMatch(id: string) {
  // JwtOptionalGuard on the backend — auth is forwarded if available so that
  // creator/authority/participant viewers see the unredacted detail and
  // invite-only matches resolve. Anonymous viewers still get public detail
  // (or 404 for invite-only).
  return apiFetch<MatchDetail>(`/matches/${id}`);
}

export type JoinMatchPayload = {
  slotId: string;
};

export function joinMatch(matchId: string, slotId: string) {
  return apiFetch<unknown>(`/matches/${matchId}/join`, {
    method: 'POST',
    body: { slotId } satisfies JoinMatchPayload,
  });
}

export function leaveMatch(matchId: string) {
  return apiFetch<unknown>(`/matches/${matchId}/leave`, {
    method: 'POST',
  });
}

export type CreateMatchPayload = {
  format: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  isLocked?: boolean;
  isInviteOnly?: boolean;
  pricePerPerson?: number;
  scheduledAt?: string;
  durationMin?: number;
  pitchName?: string;
  pitchAddress?: string;
  pitchLat?: number;
  pitchLng?: number;
  city?: string;
  district?: string;
};

export type UpdateMatchPayload = Omit<
  CreateMatchPayload,
  'format' | 'isInviteOnly'
>;

export function createMatch(payload: CreateMatchPayload) {
  return apiFetch<MatchDetail>('/matches', {
    method: 'POST',
    body: payload,
  });
}

export function updateMatch(id: string, payload: UpdateMatchPayload) {
  return apiFetch<MatchDetail>(`/matches/${id}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function cancelMatch(id: string) {
  return apiFetch<{ message: string }>(`/matches/${id}/cancel`, {
    method: 'POST',
  });
}

// ─── M4.B locked-join request flow ──────────────────────────

export type SendRequestPayload = {
  preferredPosition?: string;
};

export type SendRequestResponse = {
  id: string;
  status: 'PENDING';
  preferredPosition: string | null;
  message: string;
};

export function requestAccess(matchId: string, payload: SendRequestPayload = {}) {
  return apiFetch<SendRequestResponse>(`/matches/${matchId}/requests`, {
    method: 'POST',
    body: payload,
  });
}

export function listRequests(matchId: string) {
  return apiFetch<MatchRequest[]>(`/matches/${matchId}/requests`);
}

export type ApproveRequestResponse = {
  message: string;
  requestId: string;
  assignedSlot: { id: string; team: 'A' | 'B'; position: string };
};

export function approveRequest(matchId: string, requestId: string) {
  return apiFetch<ApproveRequestResponse>(
    `/matches/${matchId}/requests/${requestId}/approve`,
    { method: 'POST' },
  );
}

export type RejectRequestResponse = {
  message: string;
  requestId: string;
};

export function rejectRequest(matchId: string, requestId: string) {
  return apiFetch<RejectRequestResponse>(
    `/matches/${matchId}/requests/${requestId}/reject`,
    { method: 'POST' },
  );
}
