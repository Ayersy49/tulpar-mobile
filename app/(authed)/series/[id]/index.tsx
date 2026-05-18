import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getSeries,
  hideSeries,
  pauseSeries,
  resumeSeries,
  skipNextWeek,
  unhideSeries,
  type SeriesDetail,
  type SeriesMemberSummary,
} from '../../../../src/api/series';
import { getMe } from '../../../../src/api/me';
import { tr } from '../../../../src/i18n/tr';

function memberDisplayName(member: SeriesMemberSummary): string {
  const p = member.user.profile;
  if (!p) return tr.matchRequests.profilePositions([]);
  if (p.username) return p.username;
  const full = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return full || member.userId.slice(0, 8);
}

function formatInstanceLine(scheduledAt: string, weekIndex: number | null): string {
  const d = new Date(scheduledAt);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const date = `${dd}.${mm} ${hh}:${mi}`;
  return weekIndex !== null
    ? `${tr.series.weekIndex(weekIndex)} · ${date}`
    : `${tr.series.weekUnknown} · ${date}`;
}

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const me = meQuery.data;
  const seriesQuery = useQuery<SeriesDetail>({
    queryKey: ['series', id],
    queryFn: () => getSeries(id!),
    enabled: !!id,
  });

  const invalidateSelf = () =>
    qc.invalidateQueries({ queryKey: ['series', id] });
  const invalidateList = () =>
    qc.invalidateQueries({ queryKey: ['series'] });

  const mutPause = useMutation({
    mutationFn: () => pauseSeries(id!),
    onSuccess: () => {
      invalidateSelf();
      invalidateList();
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutResume = useMutation({
    mutationFn: () => resumeSeries(id!),
    onSuccess: () => {
      invalidateSelf();
      invalidateList();
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutSkip = useMutation({
    mutationFn: () => skipNextWeek(id!),
    onSuccess: invalidateSelf,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutHide = useMutation({
    mutationFn: () => hideSeries(id!),
    onSuccess: invalidateList,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutUnhide = useMutation({
    mutationFn: () => unhideSeries(id!),
    onSuccess: invalidateList,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });

  if (seriesQuery.isLoading || meQuery.isLoading || !seriesQuery.data || !me) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['top']}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const series = seriesQuery.data;
  const isAuthority =
    series.authorityAId === me.id || series.authorityBId === me.id;
  const myMembership = series.members.find((m) => m.userId === me.id);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="px-4 py-4 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-1 mb-2 active:opacity-60">
            <Ionicons name="chevron-back" size={18} color="#2563eb" />
            <Text className="text-blue-600">{tr.matchDetail.back}</Text>
          </Pressable>
          <Text className="text-xl font-semibold">{series.title}</Text>
          <Text className="text-sm text-gray-600 mt-1">
            {tr.series.dayLabels[series.dayOfWeek]} {series.timeOfDay} ·{' '}
            {series.durationMin} dk
            {series.city ? ` · ${series.city}` : ''}
          </Text>
          <View className="flex-row gap-2 mt-2">
            <Text className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-700">
              {series.teamMode === 'MIXED'
                ? tr.series.teamModeMixed
                : tr.series.teamModeFixed}
            </Text>
            {series.status === 'PAUSED' ? (
              <Text className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                {tr.series.statusPaused}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Upcoming instances */}
        <View className="px-4 py-3">
          <Text className="text-sm font-semibold text-gray-700 mb-1">
            {tr.series.upcomingHeader}
          </Text>
          {series.matches.length === 0 ? (
            <Text className="text-sm text-gray-500">{tr.series.noUpcoming}</Text>
          ) : (
            <>
              <Text className="text-xs text-gray-500 italic mb-2">
                {tr.series.upcomingHint}
              </Text>
              {series.matches.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(`/matches/${m.id}` as Href)}
                  className="flex-row items-center justify-between px-3 py-2 bg-gray-50 rounded mb-2 active:opacity-70">
                  <View className="flex-1">
                    <Text className="text-sm font-medium">
                      {formatInstanceLine(m.scheduledAt, m.seriesWeekIndex)}
                    </Text>
                    <Text className="text-xs text-gray-600 mt-0.5">{m.state}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#6b7280" />
                </Pressable>
              ))}
            </>
          )}
        </View>

        {/* Pool roster + entry */}
        <View className="px-4 py-3 border-t border-gray-100">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-gray-700">
              {tr.series.poolHeader} ·{' '}
              {tr.series.poolMembersCount(series.members.length)}
            </Text>
            <Pressable
              onPress={() => router.push(`/series/${id}/pool` as Href)}
              className="active:opacity-60">
              <Text className="text-blue-600 text-sm font-medium">
                {tr.series.poolHeader} →
              </Text>
            </Pressable>
          </View>
          <Text className="text-xs text-gray-500 mb-2">
            {tr.series.poolCapHint}
          </Text>
          {series.members.length === 0 ? (
            <Text className="text-sm text-gray-500">{tr.series.poolEmpty}</Text>
          ) : (
            series.members.slice(0, 6).map((m) => {
              const isA = series.authorityAId === m.userId;
              const isB = series.authorityBId === m.userId;
              return (
                <View
                  key={m.id}
                  className="flex-row items-center justify-between py-1">
                  <Text className="text-sm text-gray-800">
                    {memberDisplayName(m)}
                  </Text>
                  {isA || isB ? (
                    <Text className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                      {tr.series.authorityBadge}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Chat entry */}
        <Pressable
          onPress={() => router.push(`/series/${id}/chat` as Href)}
          className="px-4 py-3 border-t border-gray-100 active:opacity-70">
          <View className="flex-row items-center justify-between">
            <Text className="text-blue-700 font-medium">
              {tr.series.chatCta}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#1d4ed8" />
          </View>
        </Pressable>

        {/* Authority controls */}
        {isAuthority ? (
          <View className="px-4 py-3 border-t border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              {tr.seriesAuthority.sheetTitle}
            </Text>
            {series.status === 'ACTIVE' ? (
              <Pressable
                onPress={() => mutPause.mutate()}
                disabled={mutPause.isPending}
                className="py-2 active:opacity-60">
                <Text className="text-orange-700">{tr.series.pauseCta}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => mutResume.mutate()}
                disabled={mutResume.isPending}
                className="py-2 active:opacity-60">
                <Text className="text-green-700">{tr.series.resumeCta}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                Alert.alert('', tr.series.skipNextConfirm, [
                  { text: tr.common.cancel, style: 'cancel' },
                  {
                    text: tr.series.skipNextCta,
                    style: 'destructive',
                    onPress: () => mutSkip.mutate(),
                  },
                ])
              }
              className="py-2 active:opacity-60">
              <Text className="text-gray-700">{tr.series.skipNextCta}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/series/${id}/edit` as Href)}
              className="py-2 active:opacity-60">
              <Text className="text-blue-700">{tr.series.editFixedCta}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Self controls — hide/unhide only when series is paused */}
        {myMembership ? (
          <View className="px-4 py-3 border-t border-gray-100">
            {series.status === 'PAUSED' ? (
              myMembership.hiddenAt ? (
                <Pressable
                  onPress={() => mutUnhide.mutate()}
                  className="py-2 active:opacity-60">
                  <Text className="text-blue-700">{tr.series.unhideCta}</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => mutHide.mutate()}
                  className="py-2 active:opacity-60">
                  <Text className="text-gray-700">{tr.series.hideCta}</Text>
                </Pressable>
              )
            ) : (
              <Text className="text-xs text-gray-500">
                {tr.series.hideOnlyIfPaused}
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
