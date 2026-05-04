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
import {
  listMatches,
  type MatchListQuery,
  type MatchListResponse,
  type MatchSummary,
} from '../../src/api/matches';
import { tr } from '../../src/i18n/tr';

const FORMAT_OPTIONS = [5, 6, 7, 8, 11] as const;

type DateInput = { day: string; month: string; year: string };

const EMPTY_DATE: DateInput = { day: '', month: '', year: '' };

function dateInputToIso(d: DateInput): string | null {
  const day = d.day.trim();
  const month = d.month.trim();
  const year = d.year.trim();
  if (!day && !month && !year) return null;
  const dn = parseInt(day, 10);
  const mn = parseInt(month, 10);
  const yn = parseInt(year, 10);
  if (
    !Number.isInteger(dn) ||
    !Number.isInteger(mn) ||
    !Number.isInteger(yn) ||
    dn < 1 ||
    dn > 31 ||
    mn < 1 ||
    mn > 12 ||
    yn < 1900 ||
    yn > 2100
  ) {
    return null;
  }
  const candidate = new Date(Date.UTC(yn, mn - 1, dn));
  if (
    candidate.getUTCFullYear() !== yn ||
    candidate.getUTCMonth() !== mn - 1 ||
    candidate.getUTCDate() !== dn
  ) {
    return null;
  }
  return candidate.toISOString();
}

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

type DateRowProps = {
  label: string;
  value: DateInput;
  onChange: (v: DateInput) => void;
};

function DateRow({ label, value, onChange }: DateRowProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-gray-700">{label}</Text>
      <View className="flex-row gap-2">
        <TextInput
          value={value.day}
          onChangeText={(v) => onChange({ ...value, day: v })}
          placeholder={tr.profile.fields.day}
          keyboardType="numeric"
          maxLength={2}
          className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white"
        />
        <TextInput
          value={value.month}
          onChangeText={(v) => onChange({ ...value, month: v })}
          placeholder={tr.profile.fields.month}
          keyboardType="numeric"
          maxLength={2}
          className="flex-1 border border-gray-300 rounded-lg p-3 text-base bg-white"
        />
        <TextInput
          value={value.year}
          onChangeText={(v) => onChange({ ...value, year: v })}
          placeholder={tr.profile.fields.year}
          keyboardType="numeric"
          maxLength={4}
          className="flex-[1.5] border border-gray-300 rounded-lg p-3 text-base bg-white"
        />
      </View>
    </View>
  );
}

function MatchCard({ match }: { match: MatchSummary }) {
  return (
    <View className="border border-gray-200 rounded-xl p-4 gap-2 bg-white mb-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-semibold">
          {tr.matches.formatLabel(match.format)} · {match.difficulty}
        </Text>
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
      <Text className="text-xs text-gray-500">
        {match.createdBy}
      </Text>
    </View>
  );
}

export default function MatchesScreen() {
  const [city, setCity] = useState('');
  const [from, setFrom] = useState<DateInput>(EMPTY_DATE);
  const [to, setTo] = useState<DateInput>(EMPTY_DATE);
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
    const fromIso = dateInputToIso(from);
    const toIso = dateInputToIso(to);
    const next: MatchListQuery = {
      page: nextPage,
      limit: 20,
      city: city.trim() || undefined,
      from: fromIso ?? undefined,
      to: toIso ?? undefined,
      format: format ?? undefined,
    };
    setPage(nextPage);
    setAppliedQuery(next);
  };

  const clearFilters = () => {
    setCity('');
    setFrom(EMPTY_DATE);
    setTo(EMPTY_DATE);
    setFormat(null);
    setPage(1);
    setAppliedQuery({ page: 1, limit: 20 });
  };

  const totalPages = data?.pagination.totalPages ?? 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MatchCard match={item} />}
        contentContainerClassName="p-4"
        refreshing={isFetching && !isLoading}
        onRefresh={() => refetch()}
        ListHeaderComponent={
          <View className="gap-3 mb-4">
            <Text className="text-3xl font-bold">{tr.matches.title}</Text>

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

              <DateRow
                label={tr.matches.filters.from}
                value={from}
                onChange={setFrom}
              />
              <DateRow
                label={tr.matches.filters.to}
                value={to}
                onChange={setTo}
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
    </SafeAreaView>
  );
}
