import { apiFetch } from './client';
import type { Position } from './me';

export type FriendSummaryUser = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  position1: Position | null;
  position2?: Position | null;
  position3?: Position | null;
};

export type FriendRequest = {
  id: string;
  status: 'PENDING';
  otherUser: FriendSummaryUser;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
};

export type Friend = {
  id: string;
  user: FriendSummaryUser;
  since: string | null;
};

export function listFriends() {
  return apiFetch<Friend[]>('/friends');
}

export function listFriendRequests(direction: 'incoming' | 'outgoing') {
  return apiFetch<FriendRequest[]>(`/friend-requests?direction=${direction}`);
}

export function sendFriendRequest(userId: string) {
  return apiFetch(`/users/${userId}/friend-request`, { method: 'POST' });
}

export function acceptFriendRequest(id: string) {
  return apiFetch(`/friend-requests/${id}/accept`, { method: 'POST' });
}

export function rejectFriendRequest(id: string) {
  return apiFetch(`/friend-requests/${id}/reject`, { method: 'POST' });
}

export function cancelFriendRequest(id: string) {
  return apiFetch(`/friend-requests/${id}`, { method: 'DELETE' });
}

export function unfriend(userId: string) {
  return apiFetch(`/friends/${userId}`, { method: 'DELETE' });
}
