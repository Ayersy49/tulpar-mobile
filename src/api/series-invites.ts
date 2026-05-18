import { apiFetch } from './client';

export function createInvite(
  seriesId: string,
  inviteeUserId: string,
  notes?: string,
) {
  return apiFetch(`/series/${seriesId}/invites`, {
    method: 'POST',
    body: { inviteeUserId, notes },
  });
}

export function approveInvite(id: string) {
  return apiFetch(`/series-invites/${id}/approve`, { method: 'POST' });
}

export function rejectInvite(id: string) {
  return apiFetch(`/series-invites/${id}/reject`, { method: 'POST' });
}

export function acceptInvite(id: string) {
  return apiFetch(`/series-invites/${id}/accept`, { method: 'POST' });
}

export function declineInvite(id: string) {
  return apiFetch(`/series-invites/${id}/decline`, { method: 'POST' });
}

export function removeMember(seriesId: string, userId: string) {
  return apiFetch(`/series/${seriesId}/members/${userId}`, { method: 'DELETE' });
}

export function assignTeamMember(
  seriesId: string,
  teamId: string,
  userId: string,
) {
  return apiFetch(`/series/${seriesId}/teams/${teamId}/members`, {
    method: 'POST',
    body: { userId },
  });
}

export function unassignTeamMember(
  seriesId: string,
  teamId: string,
  userId: string,
) {
  return apiFetch(`/series/${seriesId}/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  });
}
