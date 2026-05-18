import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listSeries, type SeriesSummary } from '../../../src/api/series';
import { tr } from '../../../src/i18n/tr';

const QUERY_KEY = ['series', 'list'] as const;

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return tr.matches.timeFallback;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm} ${hh}:${mi}`;
}

export default function SeriesListScreen() {
  const router = useRouter();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listSeries(false),
  });

  const renderItem = ({ item }: { item: SeriesSummary }) => (
    <Pressable
      onPress={() => router.push(`/series/${item.seriesId}` as Href)}
      className="px-4 py-3 border-b border-gray-100 active:bg-gray-50">
      <View className="flex-row items-center justify-between">
        <Text className="font-medium text-base text-gray-900">{item.title}</Text>
        {item.status === 'PAUSED' ? (
          <Text className="text-xs font-semibold text-orange-700">
            {tr.series.statusPaused}
          </Text>
        ) : null}
      </View>
      <Text className="text-sm text-gray-600 mt-0.5">
        {item.teamMode === 'MIXED'
          ? tr.series.teamModeMixed
          : tr.series.teamModeFixed}
      </Text>
      <Text className="text-sm text-gray-500 mt-1">
        {item.nextInstance
          ? `${tr.series.nextInstanceLabel}: ${formatScheduledAt(item.nextInstance.scheduledAt)}`
          : tr.series.noUpcoming}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-lg font-semibold">{tr.series.tabTitle}</Text>
        <Pressable
          onPress={() => router.push('/series/create' as Href)}
          className="flex-row items-center gap-1 bg-blue-600 px-3 py-1.5 rounded-full active:opacity-80">
          <Ionicons name="add" color="#fff" size={16} />
          <Text className="text-white text-sm font-medium">
            {tr.series.createCta}
          </Text>
        </Pressable>
      </View>
      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-sm text-red-700 mb-3">
            {tr.series.loadFailed}
          </Text>
          <Pressable
            onPress={() => query.refetch()}
            className="bg-blue-600 rounded-md px-4 py-2 active:opacity-80">
            <Text className="text-white font-semibold">{tr.common.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(s) => s.seriesId}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text className="px-4 py-8 text-gray-500 text-center">
              {tr.series.listEmpty}
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
