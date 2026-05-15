import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../../src/api/client';
import {
  listMessages,
  sendMessage as sendChatMessage,
  type ChatMessage,
  type ChatPage,
} from '../../../../src/api/chat';
import { getMe, type MeResponse } from '../../../../src/api/me';
import {
  subscribeToMatchChat,
  type ChatMessageEvent,
} from '../../../../src/lib/socket';
import { tr } from '../../../../src/i18n/tr';

type LocalMessage = ChatMessage & { pending?: boolean; failed?: boolean };

const PAGE_LIMIT = 30;

function makeTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export default function ChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => getMe(),
    staleTime: 60_000,
  });
  const myUserId = meQuery.data?.id ?? null;

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial load. Backend returns newest-first; we store the array as-is and
  // render with `inverted` so index 0 sits at the bottom visually.
  const initialQuery = useQuery<ChatPage>({
    queryKey: ['chat', matchId],
    queryFn: () => listMessages(matchId, { limit: PAGE_LIMIT }),
    enabled: !!matchId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (initialQuery.data) {
      setMessages(initialQuery.data.messages as LocalMessage[]);
      setNextCursor(initialQuery.data.nextCursor);
    }
  }, [initialQuery.data]);

  // WS broadcast. Backend fires chat:message to the match room on every
  // send (including our own). We dedup by id and reconcile our optimistic
  // temp msgs in-place so the user never sees a duplicate during the
  // HTTP-vs-WS race window.
  useEffect(() => {
    if (!matchId) return;
    return subscribeToMatchChat(matchId, (incoming: ChatMessageEvent) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        if (myUserId && incoming.user.userId === myUserId) {
          // Sender-side echo. If a pending temp with matching content is
          // still around, swap it in place instead of prepending — avoids
          // the brief double-render when WS beats the HTTP response.
          const idx = prev.findIndex(
            (m) => m.pending && m.content === incoming.content,
          );
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = { ...incoming };
            return copy;
          }
        }
        return [incoming as LocalMessage, ...prev];
      });
    });
  }, [matchId, myUserId]);

  const handleLoadOlder = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listMessages(matchId, {
        cursor: nextCursor,
        limit: PAGE_LIMIT,
      });
      setMessages((prev) => [...prev, ...(page.messages as LocalMessage[])]);
      setNextCursor(page.nextCursor);
    } catch {
      Alert.alert(tr.common.error, tr.chat.loadFailed);
    } finally {
      setLoadingMore(false);
    }
  }, [matchId, nextCursor, loadingMore]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (content.length > 500) {
      Alert.alert(tr.common.error, tr.chat.tooLong);
      return;
    }

    const tempId = makeTempId();
    const tempMsg: LocalMessage = {
      id: tempId,
      content,
      isSystem: false,
      createdAt: new Date().toISOString(),
      user: {
        userId: myUserId ?? 'me',
        username: meQuery.data?.profile?.username ?? null,
      },
      pending: true,
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setDraft('');
    setSending(true);

    try {
      const server = await sendChatMessage(matchId, content);
      setMessages((prev) => {
        // If the WS echo already reconciled our temp into a server-id row,
        // just remove any leftover temp with the same id (defense in depth).
        if (prev.some((m) => m.id === server.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? { ...server } : m));
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m,
        ),
      );
      const apiErr = err instanceof ApiError ? err : null;
      const backendMessage =
        apiErr &&
        typeof apiErr.body === 'object' &&
        apiErr.body !== null &&
        'message' in apiErr.body
          ? String((apiErr.body as { message: unknown }).message)
          : null;
      Alert.alert(tr.common.error, backendMessage ?? tr.chat.sendFailed);
    } finally {
      setSending(false);
    }
  }, [draft, sending, matchId, myUserId, meQuery.data]);

  const renderItem = useCallback(
    ({ item }: { item: LocalMessage }) => (
      <MessageRow
        message={item}
        myUserId={myUserId}
        onOpenProfile={(userId) =>
          router.push(`/users/${userId}` as Href)
        }
      />
    ),
    [myUserId, router],
  );

  const keyExtractor = useCallback((m: LocalMessage) => m.id, []);

  const loadFailed = initialQuery.isError;

  const listFooter = useMemo(() => {
    // FlatList is inverted: footer renders at the TOP visually (older end).
    if (loadingMore) {
      return (
        <View className="py-3">
          <ActivityIndicator size="small" />
        </View>
      );
    }
    if (nextCursor) {
      return (
        <Pressable
          onPress={handleLoadOlder}
          className="py-3 items-center active:opacity-60">
          <Text className="text-sm text-blue-600 font-medium">
            {tr.chat.loadMore}
          </Text>
        </Pressable>
      );
    }
    return null;
  }, [loadingMore, nextCursor, handleLoadOlder]);

  if (!matchId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-600">{tr.common.error}</Text>
      </SafeAreaView>
    );
  }

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
        <Text className="text-base font-bold">{tr.chat.title}</Text>
        <View style={{ width: 56 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        className="flex-1">
        {initialQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : loadFailed ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-sm text-red-700">{tr.chat.loadFailed}</Text>
            <Pressable
              onPress={() => initialQuery.refetch()}
              className="mt-3 bg-blue-600 rounded-md px-4 py-2 active:opacity-80">
              <Text className="text-white font-semibold">
                {tr.common.retry}
              </Text>
            </Pressable>
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-sm text-gray-500 italic">
              {tr.chat.empty}
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            inverted
            contentContainerStyle={{ padding: 12, gap: 6 }}
            ListFooterComponent={listFooter}
            onEndReached={handleLoadOlder}
            onEndReachedThreshold={0.3}
          />
        )}

        <View className="flex-row items-end gap-2 p-2 border-t border-gray-200 bg-white">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr.chat.inputPlaceholder}
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={500}
            className="flex-1 border border-gray-300 rounded-2xl px-3 py-2 text-sm text-gray-900 bg-gray-50"
            style={{ maxHeight: 100 }}
          />
          <Pressable
            disabled={sending || draft.trim().length === 0}
            onPress={handleSend}
            className={`rounded-full p-2 active:opacity-80 ${
              sending || draft.trim().length === 0
                ? 'bg-gray-300'
                : 'bg-blue-600'
            }`}>
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={18} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type MessageRowProps = {
  message: LocalMessage;
  myUserId: string | null;
  onOpenProfile: (userId: string) => void;
};

function MessageRow({
  message,
  myUserId,
  onOpenProfile,
}: MessageRowProps) {
  if (message.isSystem) {
    return (
      <View className="items-center my-1">
        <Text className="text-xs text-gray-500 italic text-center">
          {message.content}
        </Text>
      </View>
    );
  }

  const isMine = myUserId !== null && message.user.userId === myUserId;
  const alignCls = isMine ? 'items-end' : 'items-start';
  const bubbleCls = isMine
    ? message.failed
      ? 'bg-red-200'
      : message.pending
        ? 'bg-blue-300'
        : 'bg-blue-600'
    : 'bg-white border border-gray-200';
  const textColor = isMine ? 'text-white' : 'text-gray-900';

  return (
    <View className={alignCls}>
      {!isMine && message.user.username ? (
        <Pressable
          onPress={() => onOpenProfile(message.user.userId)}
          className="px-1 active:opacity-60">
          <Text className="text-xs text-gray-500 mb-0.5">
            {message.user.username}
          </Text>
        </Pressable>
      ) : null}
      <View
        className={`rounded-2xl px-3 py-2 ${bubbleCls}`}
        style={{ maxWidth: '80%' }}>
        <Text className={`text-sm ${textColor}`}>{message.content}</Text>
      </View>
      <Text className="text-[10px] text-gray-400 mt-0.5 px-1">
        {formatTimestamp(message.createdAt)}
        {message.pending ? ' · ...' : ''}
        {message.failed ? ' · ✕' : ''}
      </Text>
    </View>
  );
}
