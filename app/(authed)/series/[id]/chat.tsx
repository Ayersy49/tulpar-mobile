import { useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSeriesChatMessages,
  sendSeriesChatMessage,
  type SeriesChatMessage,
} from '../../../../src/api/series-chat';
import { getMe } from '../../../../src/api/me';
import { tr } from '../../../../src/i18n/tr';

const PAGE_LIMIT = 50;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export default function SeriesChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = id ?? '';
  const qc = useQueryClient();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });

  const messagesQuery = useQuery({
    queryKey: ['series-chat', seriesId],
    queryFn: () => listSeriesChatMessages(seriesId, { limit: PAGE_LIMIT }),
    enabled: !!seriesId,
    refetchOnMount: 'always',
  });

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // The series_chat:message WS event is already wired at layout scope (Task 3)
  // to invalidate the series-chat root, so any active query refetches when a
  // new message lands — we don't need a per-screen subscription here.

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendSeriesChatMessage(seriesId, trimmed);
      setDraft('');
      qc.invalidateQueries({ queryKey: ['series-chat', seriesId] });
    } catch (e) {
      Alert.alert(
        tr.series.chatSendFailed,
        e instanceof Error ? e.message : tr.common.error,
      );
    } finally {
      setSending(false);
    }
  };

  if (messagesQuery.isLoading || meQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (messagesQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-4">
        <Text className="text-sm text-red-700 mb-3">
          {tr.series.chatLoadFailed}
        </Text>
        <Pressable
          onPress={() => messagesQuery.refetch()}
          className="bg-blue-600 rounded-md px-4 py-2 active:opacity-80">
          <Text className="text-white font-semibold">{tr.common.retry}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const messages = messagesQuery.data?.messages ?? [];
  const myUserId = meQuery.data?.id ?? null;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <FlatList
          data={messages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
          ListEmptyComponent={
            <Text className="text-sm text-gray-500 text-center py-8">
              {tr.series.chatEmpty}
            </Text>
          }
          renderItem={({ item }: { item: SeriesChatMessage }) => {
            const mine = !!myUserId && item.user.userId === myUserId;
            return (
              <View
                className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                  mine
                    ? 'self-end bg-blue-600'
                    : 'self-start bg-gray-100'
                }`}>
                {!mine ? (
                  <Text className="text-xs text-gray-600 mb-0.5">
                    {item.user.username ?? '—'}
                  </Text>
                ) : null}
                <Text className={mine ? 'text-white' : 'text-gray-900'}>
                  {item.content}
                </Text>
                <Text
                  className={`text-[10px] mt-0.5 ${mine ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatTimestamp(item.createdAt)}
                </Text>
              </View>
            );
          }}
        />
        <View className="flex-row gap-2 px-3 py-2 border-t border-gray-100 bg-white">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr.series.chatComposerPlaceholder}
            multiline
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 max-h-32"
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            className={`px-4 py-2 rounded-full justify-center ${
              !draft.trim() || sending ? 'bg-gray-300' : 'bg-blue-600'
            } active:opacity-80`}>
            <Text className="text-white font-medium">{tr.series.chatSend}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
