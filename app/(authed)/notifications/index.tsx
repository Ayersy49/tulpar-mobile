import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationsPage,
} from '../../../src/api/notifications';
import { useNotificationsStore } from '../../../src/notifications/store';
import { tr } from '../../../src/i18n/tr';

const PAGE_LIMIT = 20;

// All current backend notification types attach { matchId } in `data` and
// route to match detail. The detail screen itself shows the right state —
// CANCELLED banner for match_cancelled, organizer panel for join_request,
// joined slot for request_approved, etc. Future notification types should
// add their own branch here (e.g. a future direct-message type might route
// to a conversation screen).
function routeForNotification(n: NotificationItem): Href | null {
  const matchId =
    n.data && typeof (n.data as Record<string, unknown>).matchId === 'string'
      ? ((n.data as Record<string, unknown>).matchId as string)
      : null;
  if (!matchId) return null;
  return `/matches/${matchId}` as Href;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUnread = useNotificationsStore((s) => s.setUnread);
  const decrementUnread = useNotificationsStore((s) => s.decrementUnread);
  const clearUnread = useNotificationsStore((s) => s.clearUnread);

  const query = useQuery<NotificationsPage>({
    queryKey: ['notifications', 1],
    queryFn: () => listNotifications({ page: 1, limit: PAGE_LIMIT }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Seed the global unread badge whenever this screen reads a fresh page.
  useEffect(() => {
    if (query.data) setUnread(query.data.unreadCount);
  }, [query.data, setUnread]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onError: () => {
      Alert.alert(tr.common.error, tr.notifications.loadFailed);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      clearUnread();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => {
      Alert.alert(tr.common.error, tr.notifications.loadFailed);
    },
  });

  const handleRowPress = useCallback(
    (n: NotificationItem) => {
      // Mark unread → read (optimistic + fire-and-forget HTTP). Read rows skip.
      if (!n.read) {
        queryClient.setQueryData<NotificationsPage>(
          ['notifications', 1],
          (prev) =>
            prev
              ? {
                  ...prev,
                  notifications: prev.notifications.map((x) =>
                    x.id === n.id ? { ...x, read: true } : x,
                  ),
                  unreadCount: Math.max(0, prev.unreadCount - 1),
                }
              : prev,
        );
        decrementUnread();
        markReadMutation.mutate(n.id);
      }
      // Deep-link to the relevant screen if the payload tells us where.
      const route = routeForNotification(n);
      if (route) router.push(route);
    },
    [decrementUnread, markReadMutation, queryClient, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow item={item} onPress={() => handleRowPress(item)} />
    ),
    [handleRowPress],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 active:opacity-60">
          <Ionicons name="chevron-back" size={20} color="#2563eb" />
          <Text className="text-blue-600 font-semibold">
            {tr.matchDetail.back}
          </Text>
        </Pressable>
        <Text className="text-base font-bold">{tr.notifications.title}</Text>
        <View style={{ width: 56 }} />
      </View>

      {(query.data?.unreadCount ?? 0) > 0 ? (
        <View className="px-4 py-2 border-b border-gray-200 bg-white">
          <Pressable
            disabled={markAllMutation.isPending}
            onPress={() => markAllMutation.mutate()}
            className="self-end active:opacity-60">
            <Text className="text-sm font-semibold text-blue-600">
              {markAllMutation.isPending
                ? tr.notifications.marking
                : tr.notifications.markAllRead}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-sm text-red-700">
            {tr.notifications.loadFailed}
          </Text>
          <Pressable
            onPress={() => query.refetch()}
            className="mt-3 bg-blue-600 rounded-md px-4 py-2 active:opacity-80">
            <Text className="text-white font-semibold">{tr.common.retry}</Text>
          </Pressable>
        </View>
      ) : (query.data?.notifications.length ?? 0) === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-sm text-gray-500 italic">
            {tr.notifications.empty}
          </Text>
        </View>
      ) : (
        <FlatList
          data={query.data?.notifications ?? []}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isLoading}
              onRefresh={() => query.refetch()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

type NotificationRowProps = {
  item: NotificationItem;
  onPress: () => void;
};

function NotificationRow({ item, onPress }: NotificationRowProps) {
  const unreadBg = !item.read ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200';
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg border p-3 active:opacity-70 ${unreadBg}`}>
      <View className="flex-row items-start gap-2">
        {!item.read ? (
          <View className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
        ) : (
          <View className="w-2 h-2 mt-1.5" />
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold text-gray-900">
            {item.title}
          </Text>
          {item.body ? (
            <Text className="text-sm text-gray-700">{item.body}</Text>
          ) : null}
          <Text className="text-xs text-gray-400 mt-1">
            {tr.notifications.relativeTime(item.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
