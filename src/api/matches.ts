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
  teamA: MatchSlot[];
  teamB: MatchSlot[];
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
