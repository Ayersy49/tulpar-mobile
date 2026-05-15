import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../src/api/client';
import { getMe, type MeResponse } from '../../../src/api/me';
import { getPublicUser, type PublicUser } from '../../../src/api/users';
import { getRatingsForUser, type UserRatings } from '../../../src/api/ratings';
import { RatingsCard } from '../../../src/components/RatingsCard';
import { ReportPlayerSheet } from '../../../src/components/ReportPlayerSheet';
import { tr } from '../../../src/i18n/tr';

export default function PublicUserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = id ?? '';
  const [reportOpen, setReportOpen] = useState(false);

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const myId = meQuery.data?.id ?? null;
  const isSelf = !!myId && userId === myId;
  const canLoadTarget = !!userId && meQuery.isSuccess && !isSelf;

  const publicQuery = useQuery<PublicUser>({
    queryKey: ['user-public', userId],
    queryFn: () => getPublicUser(userId),
    enabled: canLoadTarget,
  });
  const ratingsQuery = useQuery<UserRatings>({
    queryKey: ['user-ratings', userId],
    queryFn: () => getRatingsForUser(userId),
    enabled: canLoadTarget,
  });

  if (isSelf) {
    return <Redirect href="/profile" />;
  }

  if (!userId) {
    return <NotFoundScreen onBack={() => router.back()} />;
  }

  if (meQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (meQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-white p-6 gap-3">
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-semibold">{tr.common.error}</Text>
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

  if (publicQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (publicQuery.error) {
    const notFound =
      publicQuery.error instanceof ApiError && publicQuery.error.status === 404;
    if (notFound) {
      return <NotFoundScreen onBack={() => router.back()} />;
    }
    return (
      <SafeAreaView className="flex-1 bg-white p-6 gap-3">
        <BackButton onPress={() => router.back()} />
        <Text className="text-lg font-semibold">{tr.common.error}</Text>
        <Text className="text-sm text-gray-600">
          {publicQuery.error instanceof Error
            ? publicQuery.error.message
            : tr.common.error}
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg p-4 active:opacity-80"
          onPress={() => publicQuery.refetch()}>
          <Text className="text-white text-center font-semibold">
            {tr.common.retry}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const user = publicQuery.data;
  if (!user) return null;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.username ||
    tr.userProfile.unnamed;
  const location =
    [user.city, user.district].filter(Boolean).join(' / ') ||
    tr.userProfile.locationFallback;
  const positions = [user.position1, user.position2, user.position3].filter(
    Boolean,
  ) as string[];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="p-6 gap-4"
        refreshControl={
          <RefreshControl
            refreshing={publicQuery.isFetching || ratingsQuery.isFetching}
            onRefresh={() => {
              publicQuery.refetch();
              ratingsQuery.refetch();
            }}
          />
        }>
        <BackButton onPress={() => router.back()} />

        <View className="gap-1">
          <Text className="text-3xl font-bold">{displayName}</Text>
          {user.username ? (
            <Text className="text-sm text-gray-500">@{user.username}</Text>
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

        <Pressable
          className="bg-red-600 rounded-lg p-4 active:opacity-80 mt-2"
          onPress={() => setReportOpen(true)}>
          <Text className="text-white text-center font-semibold">
            {tr.userProfile.reportCta}
          </Text>
        </Pressable>
      </ScrollView>

      <ReportPlayerSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedUserId={userId}
        reportedDisplayName={displayName}
      />
    </SafeAreaView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="self-start active:opacity-60">
      <Text className="text-blue-600 font-semibold">{tr.matchDetail.back}</Text>
    </Pressable>
  );
}

function NotFoundScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-white p-6 gap-4">
      <BackButton onPress={onBack} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-semibold text-gray-700">
          {tr.userProfile.notFound}
        </Text>
      </View>
    </SafeAreaView>
  );
}
