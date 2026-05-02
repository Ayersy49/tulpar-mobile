import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { tr } from '../../src/i18n/tr';

type HealthResponse = {
  status: 'healthy' | 'degraded';
  database: 'connected' | 'disconnected';
  timestamp: string;
};

export default function HealthScreen() {
  const signOut = useAuthStore((s) => s.signOut);

  const { data, error, isLoading, refetch, isFetching } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health', { auth: false }),
  });

  const statusLabel =
    data?.status === 'healthy'
      ? tr.health.healthy
      : data?.status === 'degraded'
        ? tr.health.degraded
        : tr.health.unreachable;

  const statusColor =
    data?.status === 'healthy'
      ? 'bg-green-100 border-green-500'
      : data?.status === 'degraded'
        ? 'bg-yellow-100 border-yellow-500'
        : 'bg-red-100 border-red-500';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-4">
        <Text className="text-3xl font-bold">{tr.health.title}</Text>

        {isLoading ? (
          <Text className="text-base text-gray-600">{tr.common.loading}</Text>
        ) : error ? (
          <View className="border-2 border-red-500 bg-red-100 rounded-lg p-4 gap-2">
            <Text className="text-lg font-semibold">{tr.health.unreachable}</Text>
            <Text className="text-sm text-red-900">{(error as Error).message}</Text>
          </View>
        ) : data ? (
          <View className={`border-2 rounded-lg p-4 gap-2 ${statusColor}`}>
            <Text className="text-lg font-semibold">{statusLabel}</Text>
            <Text className="text-sm">
              {tr.health.database}:{' '}
              {data.database === 'connected'
                ? tr.health.connected
                : tr.health.disconnected}
            </Text>
            <Text className="text-xs text-gray-700">{data.timestamp}</Text>
          </View>
        ) : null}

        <Pressable
          className="bg-blue-600 rounded-lg p-4 active:opacity-80"
          onPress={() => refetch()}
          disabled={isFetching}>
          <Text className="text-white text-center font-semibold">
            {isFetching ? tr.common.loading : tr.health.refresh}
          </Text>
        </Pressable>

        <Pressable
          className="border border-gray-400 rounded-lg p-4 active:opacity-80"
          onPress={() => void signOut()}>
          <Text className="text-center font-semibold">{tr.health.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
