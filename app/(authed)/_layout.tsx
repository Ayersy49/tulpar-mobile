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

  // Friendship WS events are hints to refresh the social graph. Keep this at
  // layout scope so a request accepted while the user is elsewhere still
  // updates the Friends tab and public-profile relationship state next render.
  useEffect(() => {
    if (!accessToken) return;
    const invalidateFriends = () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    };
    const cleanups = [
      'friend:request_received',
      'friend:request_accepted',
      'friend:request_rejected',
      'friend:request_cancelled',
      'friend:removed',
    ].map((event) => subscribeToUserEvents(event, invalidateFriends));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [accessToken, queryClient]);

  // Phase 4 S1C: series + outcome WS events. Same WS-as-hint pattern — every
  // event invalidates the relevant query roots and the screens refetch from
  // the server. RSVP counts, lineup edits, public-listing toggles, format
  // overrides, and outcome resolution all flow through here. Match and series
  // queries are both invalidated because the events can change either side
  // (e.g., series:listed_publicly mutates a Match row but mobile may also be
  // viewing the parent SeriesDetail's matches list).
  useEffect(() => {
    if (!accessToken) return;
    const invalidateSeries = () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['series-chat'] });
      queryClient.invalidateQueries({ queryKey: ['match'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['user-wdl'] });
    };
    const cleanups = [
      'series:rsvp_updated',
      'series:instance_locked',
      'series:instance_cancelled',
      'series:format_override_set',
      'series:listed_publicly',
      'series:unlisted_publicly',
      'series:lineup_updated',
      'series:invite_received',
      'series:invite_needs_approval',
      'series:invite_resolved',
      'series:paused',
      'series:resumed',
      'series:skip_next_scheduled',
      'series:member_joined',
      'series:member_removed',
      'series:edited',
      'series_chat:message',
      'match:outcome_report_request',
      'match:outcome_resolved',
    ].map((event) => subscribeToUserEvents(event, invalidateSeries));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [accessToken, queryClient]);

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
        name="series"
        options={{
          title: tr.tabs.series,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="repeat-outline" size={size} color={color} />
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
      <Tabs.Screen
        name="settings"
        options={{
          title: tr.tabs.settings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Notifications lives as a stack-pushable screen, NOT a tab. Hidden
          from the tab bar via href: null; reachable via router.push from
          the matches header bell icon (Insta/Twitter pattern). */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      {/* Friends lives as a stack-pushable social screen, not a bottom tab. */}
      <Tabs.Screen name="friends" options={{ href: null }} />
      {/* Public user profiles are stack-pushable detail screens, not a tab. */}
      <Tabs.Screen name="users" options={{ href: null }} />
    </Tabs>
  );
}
