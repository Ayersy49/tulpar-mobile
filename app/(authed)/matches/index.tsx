import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  listMatches,
  type MatchListQuery,
  type MatchListResponse,
  type MatchSummary,
} from '../../../src/api/matches';
import { tr } from '../../../src/i18n/tr';
import { DateTimeField } from '../../../src/components/DateTimeField';
import { useNotificationsStore } from '../../../src/notifications/store';
import { SeriesBadge } from '../../../src/components/SeriesBadge';

const FORMAT_OPTIONS = [5, 6, 7, 8, 9, 10, 11] as const;

function formatScheduledAt(iso: string | null): string {
  if (!iso) return tr.matches.timeFallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return tr.matches.timeFallback;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function formatLocation(m: MatchSummary): string {
  const parts = [m.city, m.district, m.pitchName].filter((p): p is string =>
    Boolean(p),
  );
  return parts.length ? parts.join(' · ') : tr.matches.locationFallback;
}

function MatchCard({
  match,
  onPress,
}: {
  match: MatchSummary;
  onPress: () => void;
}) {
  // S1C: publicly-listed series instances get the navy accent + SERİ badge so
  // they're distinguishable from classic ad-hoc matches at a glance.
  const isSeriesPublic = !!match.seriesId && match.isPubliclyListed;
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl p-4 gap-2 bg-white mb-3 active:opacity-80 ${
        isSeriesPublic
          ? 'border border-gray-200 border-l-4 border-l-blue-900'
          : 'border border-gray-200'
      }`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="text-lg font-semibold">
            {tr.matches.formatLabel(match.format)} · {match.difficulty}
          </Text>
          {isSeriesPublic ? <SeriesBadge /> : null}
        </View>
        {match.isLocked ? (
          <View className="bg-yellow-100 border border-yellow-400 rounded px-2 py-0.5">
            <Text className="text-xs font-medium text-yellow-900">LOCKED</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-sm text-gray-700">{formatLocation(match)}</Text>
      <Text className="text-sm text-gray-700">
        {formatScheduledAt(match.scheduledAt)}
      </Text>
      <View className="flex-row items-center justify-between mt-1">
        <Text className="text-sm text-gray-600">{match.capacityLabel}</Text>
        {match.pricePerPerson != null ? (
          <Text className="text-sm text-gray-600">
            {tr.matches.pricePerPerson(match.pricePerPerson)}
          </Text>
        ) : null}
      </View>
      <Text className="text-xs text-gray-500">{match.createdBy}</Text>
    </Pressable>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const [city, setCity] = useState('');
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [format, setFormat] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [appliedQuery, setAppliedQuery] = useState<MatchListQuery>({
    page: 1,
    limit: 20,
  });

  const { data, error, isLoading, isFetching, refetch } =
    useQuery<MatchListResponse>({
      queryKey: ['matches', appliedQuery],
      queryFn: () => listMatches(appliedQuery),
      placeholderData: (prev) => prev,
    });

  const applyFilters = (nextPage = 1) => {
    const next: MatchListQuery = {
      page: nextPage,
      limit: 20,
      city: city.trim() || undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
      format: format ?? undefined,
    };
    setPage(nextPage);
    setAppliedQuery(next);
  };

  const clearFilters = () => {
    setCity('');
    setFrom(null);
    setTo(null);
    setFormat(null);
    setPage(1);
    setAppliedQuery({ page: 1, limit: 20 });
  };

  const totalPages = data?.pagination.totalPages ?? 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1">
      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() =>
              // Cast: typedRoutes regenerates the [id] route type on the next
              // `expo start`. Until then, the cold tsc run sees stale types.
              router.push(`/matches/${item.id}` as Href)
            }
          />
        )}
        contentContainerClassName="p-4"
        refreshing={isFetching && !isLoading}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View className="gap-3 mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-3xl font-bold">{tr.matches.title}</Text>
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => router.push('/friends' as Href)}
                  hitSlop={8}
                  className="p-2 active:opacity-60">
                  <Ionicons name="people-outline" size={26} color="#1f2937" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/notifications' as Href)}
                  hitSlop={8}
                  className="p-2 active:opacity-60">
                  <Ionicons
                    name="notifications-outline"
                    size={26}
                    color="#1f2937"
                  />
                  {unreadCount > 0 ? (
                    <View
                      className="absolute bg-red-600 rounded-full"
                      style={{
                        top: 0,
                        right: 0,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text className="text-[10px] font-bold text-white">
                        {tr.notifications.unreadBadge(unreadCount)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>

            <View className="border border-gray-200 rounded-xl p-3 gap-3 bg-white">
              <Text className="text-base font-semibold">
                {tr.matches.filters.title}
              </Text>

              <View className="gap-1">
                <Text className="text-sm font-semibold text-gray-700">
                  {tr.matches.filters.city}
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder={tr.matches.filters.cityPlaceholder}
                  className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                />
              </View>

              <DateTimeField
                label={tr.matches.filters.from}
                value={from}
                onChange={setFrom}
                mode="date"
              />
              <DateTimeField
                label={tr.matches.filters.to}
                value={to}
                onChange={setTo}
                mode="date"
              />

              <View className="gap-1">
                <Text className="text-sm font-semibold text-gray-700">
                  {tr.matches.filters.format}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => setFormat(null)}
                    className={`px-3 py-2 rounded-lg border ${
                      format === null
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-300'
                    }`}>
                    <Text
                      className={`text-sm ${
                        format === null ? 'text-white font-semibold' : 'text-gray-800'
                      }`}>
                      {tr.matches.filters.any}
                    </Text>
                  </Pressable>
                  {FORMAT_OPTIONS.map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => setFormat(f)}
                      className={`px-3 py-2 rounded-lg border ${
                        format === f
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-300'
                      }`}>
                      <Text
                        className={`text-sm ${
                          format === f ? 'text-white font-semibold' : 'text-gray-800'
                        }`}>
                        {tr.matches.formatLabel(f)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="flex-row gap-2 mt-1">
                <Pressable
                  onPress={clearFilters}
                  className="flex-1 border border-gray-400 rounded-lg p-3 active:opacity-80">
                  <Text className="text-center font-semibold">
                    {tr.matches.filters.clear}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => applyFilters(1)}
                  className="flex-1 bg-blue-600 rounded-lg p-3 active:opacity-80">
                  <Text className="text-center font-semibold text-white">
                    {tr.matches.filters.apply}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View className="border-2 border-red-500 bg-red-100 rounded-lg p-3">
                <Text className="text-sm text-red-900">
                  {tr.matches.loadFailed}: {(error as Error).message}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator />
            </View>
          ) : (
            <View className="items-center py-10">
              <Text className="text-gray-600">{tr.matches.empty}</Text>
            </View>
          )
        }
        ListFooterComponent={
          (data?.data.length ?? 0) > 0 ? (
            <View className="flex-row items-center justify-between mt-2 mb-6">
              <Pressable
                disabled={!canPrev}
                onPress={() => applyFilters(page - 1)}
                className={`px-4 py-2 rounded-lg border ${
                  canPrev ? 'border-gray-400 bg-white' : 'border-gray-200 bg-gray-100'
                }`}>
                <Text
                  className={`text-sm font-semibold ${
                    canPrev ? 'text-gray-800' : 'text-gray-400'
                  }`}>
                  {tr.matches.pagination.prev}
                </Text>
              </Pressable>
              <Text className="text-sm text-gray-700">
                {tr.matches.pagination.pageOf(page, totalPages)}
              </Text>
              <Pressable
                disabled={!canNext}
                onPress={() => applyFilters(page + 1)}
                className={`px-4 py-2 rounded-lg border ${
                  canNext ? 'border-gray-400 bg-white' : 'border-gray-200 bg-gray-100'
                }`}>
                <Text
                  className={`text-sm font-semibold ${
                    canNext ? 'text-gray-800' : 'text-gray-400'
                  }`}>
                  {tr.matches.pagination.next}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <Pressable
        onPress={() => router.push('/matches/create' as Href)}
        className="absolute bottom-6 right-6 bg-blue-600 rounded-full px-5 py-3 flex-row items-center gap-2 active:opacity-80"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
          elevation: 4,
        }}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text className="text-white font-semibold">
          {tr.matches.createCta}
        </Text>
      </Pressable>
      </View>
    </SafeAreaView>
  );
}
