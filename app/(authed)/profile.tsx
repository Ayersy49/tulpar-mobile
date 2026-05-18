import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getMe, type MeResponse } from '../../src/api/me';
import { getRatingsForUser, type UserRatings } from '../../src/api/ratings';
import { RatingsCard } from '../../src/components/RatingsCard';
import { WdlStrip } from '../../src/components/WdlStrip';
import { tr } from '../../src/i18n/tr';

export default function ProfileScreen() {
  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getMe,
  });
  const ratingsQuery = useQuery<UserRatings>({
    queryKey: ['user-ratings', meQuery.data?.id ?? null],
    queryFn: () => getRatingsForUser(meQuery.data!.id),
    enabled: !!meQuery.data?.id,
  });

  if (meQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (meQuery.error || !meQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-white p-6 gap-3">
        <Text className="text-lg font-semibold">{tr.profile.loadFailed}</Text>
        <Text className="text-sm text-gray-600">
          {meQuery.error instanceof Error ? meQuery.error.message : tr.common.error}
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg p-4 active:opacity-80"
          onPress={() => meQuery.refetch()}>
          <Text className="text-white text-center font-semibold">
            {tr.common.retry}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const profile = meQuery.data.profile;
  const displayName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
    profile?.username ||
    tr.userProfile.unnamed;
  const location =
    [profile?.city, profile?.district].filter(Boolean).join(' / ') ||
    tr.userProfile.locationFallback;
  const positions = [
    profile?.position1,
    profile?.position2,
    profile?.position3,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-4">
        <View className="gap-1">
          <Text className="text-3xl font-bold">{displayName}</Text>
          {profile?.username ? (
            <Text className="text-sm text-gray-500">@{profile.username}</Text>
          ) : null}
          <Text className="text-sm text-gray-700">{location}</Text>
          {positions.length > 0 ? (
            <Text className="text-xs text-gray-500">
              {tr.userProfile.positionsLabel}: {positions.join(', ')}
            </Text>
          ) : null}
        </View>

        <RatingsCard
          ratings={ratingsQuery.data}
          isLoading={ratingsQuery.isLoading}
          error={(ratingsQuery.error as Error | null) ?? null}
          onRetry={() => ratingsQuery.refetch()}
        />

        <WdlStrip userId={meQuery.data.id} />

      </ScrollView>
    </SafeAreaView>
  );
}
