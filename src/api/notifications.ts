import { apiFetch } from './client';

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
};

export type NotificationsPage = {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
};

export type ListNotificationsQuery = {
  page?: number;
  limit?: number;
};

function buildQuery(q: ListNotificationsQuery): string {
  const params = new URLSearchParams();
  if (q.page !== undefined) params.set('page', String(q.page));
  if (q.limit !== undefined) params.set('limit', String(q.limit));
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function listNotifications(query: ListNotificationsQuery = {}) {
  return apiFetch<NotificationsPage>(`/notifications${buildQuery(query)}`);
}

export function markNotificationRead(id: string) {
  return apiFetch<{ message: string }>(`/notifications/${id}/read`, {
    method: 'POST',
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ message: string }>(`/notifications/read-all`, {
    method: 'POST',
  });
}

export type NotificationPushEvent = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: string;
};
