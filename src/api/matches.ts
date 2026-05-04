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
