import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/auth/store';
import { useNotificationsStore } from '../../src/notifications/store';
import { subscribeToUserEvents } from '../../src/lib/socket';
import {
  listNotifications,
  type NotificationPushEvent,
} from '../../src/api/notifications';
import { tr } from '../../src/i18n/tr';

export default function AuthedLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const setUnread = useNotificationsStore((s) => s.setUnread);
  const bumpUnread = useNotificationsStore((s) => s.bumpUnread);

  // Seed the unread badge on first authed mount so users see the correct
  // count even before they open the notifications screen. Fire-and-forget;
  // the inbox screen still does its own refetch on mount.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listNotifications({ page: 1, limit: 1 })
      .then((page) => {
        if (!cancelled) setUnread(page.unreadCount);
      })
      .catch(() => {
        // Silent — the inbox screen surfaces failures explicitly.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, setUnread]);

  // Global `notification` WS listener — fires on every push regardless of
  // which screen the user is on. Bumps the badge so the bell on the matches
  // list updates live, and invalidates the inbox query so the next open is
  // fresh.
  useEffect(() => {
    if (!accessToken) return;
    return subscribeToUserEvents('notification', (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const evt = payload as NotificationPushEvent;
      if (!evt.id) return;
      bumpUnread();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
  }, [accessToken, bumpUnread, queryClient]);

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
      }}>
      <Tabs.Screen
        name="matches"
        options={{
          title: tr.tabs.matches,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr.tabs.profile,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: tr.tabs.health,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Notifications lives as a stack-pushable screen, NOT a tab. Hidden
          from the tab bar via href: null; reachable via router.push from
          the matches header bell icon (Insta/Twitter pattern). */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      {/* Public user profiles are stack-pushable detail screens, not a tab. */}
      <Tabs.Screen name="users" options={{ href: null }} />
    </Tabs>
  );
}
