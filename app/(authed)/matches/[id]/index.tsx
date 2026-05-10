import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../../src/api/client';
import {
  getMatch,
  joinMatch,
  leaveMatch,
  type MatchDetail,
  type MatchSlot,
  type SlotPlayer,
} from '../../../../src/api/matches';
import { getMe, type MeResponse } from '../../../../src/api/me';
import { subscribeToMatch } from '../../../../src/lib/socket';
import { tr } from '../../../../src/i18n/tr';

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

function formatLocation(m: MatchDetail): string {
  const parts = [m.city, m.district, m.pitchName].filter((p): p is string =>
    Boolean(p),
  );
  return parts.length ? parts.join(' · ') : tr.matches.locationFallback;
}

function isIdentified(
  player: SlotPlayer | null,
): player is { userId: string; username: string | null; joinedAt: string } {
  return !!player && 'userId' in player;
}

function joinDisabledReason(state: string, isLocked: boolean): string | null {
  if (isLocked) return tr.matchDetail.errors.lockedJoin;
  if (state === 'CANCELLED') return tr.matchDetail.errors.cancelled;
  if (state !== 'OPEN' && state !== 'DRAFT') {
    // LIVE / RATING_WINDOW / CLOSED — joining doesn't apply
    return tr.matchDetail.errors.cancelled;
  }
  return null;
}

type SlotProps = {
  slot: MatchSlot;
  isMe: boolean;
  isJoining: boolean;
  canJoin: boolean;
  onJoin: (slotId: string) => void;
};

function SlotCard({ slot, isMe, isJoining, canJoin, onJoin }: SlotProps) {
  const filled = slot.player !== null;
  const player = slot.player;

  // Reserve slots get a dashed border tint so they read as bench, not pitch.
  const reserveBorder = slot.isReserve ? 'border-dashed' : '';

  if (filled) {
    const usernameLabel = isIdentified(player)
      ? player.username ?? '—'
      : '—';
    const containerCls = isMe
      ? 'border-2 border-blue-500 bg-blue-50'
      : 'border border-gray-300 bg-white';
    return (
      <View
        className={`flex-row items-center justify-between rounded-lg px-3 py-3 ${containerCls} ${reserveBorder}`}>
        <View className="flex-row items-center gap-2">
          <View className="bg-gray-200 rounded px-2 py-0.5">
            <Text className="text-xs font-semibold text-gray-800">
              {slot.position}
            </Text>
          </View>
          <Text className="text-sm font-medium text-gray-900">
            {usernameLabel}
          </Text>
          {isMe ? (
            <Text className="text-xs text-blue-700 font-semibold">
              ({tr.matchDetail.youAreHere})
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      disabled={!canJoin || isJoining}
      onPress={() => onJoin(slot.id)}
      className={`flex-row items-center justify-between rounded-lg px-3 py-3 border bg-gray-50 active:opacity-80 ${reserveBorder} ${
        canJoin ? 'border-gray-300' : 'border-gray-200 opacity-60'
      }`}>
      <View className="flex-row items-center gap-2">
        <View className="bg-gray-200 rounded px-2 py-0.5">
          <Text className="text-xs font-semibold text-gray-800">
            {slot.position}
          </Text>
        </View>
        <Text className="text-sm text-gray-500 italic">
          {tr.matchDetail.emptySlot}
        </Text>
      </View>
      {isJoining ? (
        <ActivityIndicator size="small" />
      ) : canJoin ? (
        <Text className="text-xs font-semibold text-blue-600">
          {tr.matchDetail.join}
        </Text>
      ) : null}
    </Pressable>
  );
}

type TeamSectionProps = {
  label: string;
  slots: MatchSlot[];
  myUserId: string | null;
  joiningSlotId: string | null;
  canJoin: boolean;
  onJoin: (slotId: string) => void;
};

function TeamSection({
  label,
  slots,
  myUserId,
  joiningSlotId,
  canJoin,
  onJoin,
}: TeamSectionProps) {
  const starters = slots.filter((s) => !s.isReserve);
  const reserves = slots.filter((s) => s.isReserve);

  const renderSlot = (slot: MatchSlot) => {
    const isMe =
      isIdentified(slot.player) && slot.player.userId === myUserId;
    return (
      <SlotCard
        key={slot.id}
        slot={slot}
        isMe={isMe}
        isJoining={joiningSlotId === slot.id}
        canJoin={canJoin && slot.player === null}
        onJoin={onJoin}
      />
    );
  };

  return (
    <View className="gap-2">
      <Text className="text-lg font-bold mt-2">{label}</Text>
      <Text className="text-xs font-semibold text-gray-500 uppercase">
        {tr.matchDetail.starters}
      </Text>
      <View className="gap-2">{starters.map(renderSlot)}</View>
      {reserves.length > 0 ? (
        <>
          <Text className="text-xs font-semibold text-gray-500 uppercase mt-2">
            {tr.matchDetail.reserves}
          </Text>
          <View className="gap-2">{reserves.map(renderSlot)}</View>
        </>
      ) : null}
    </View>
  );
}

export default function MatchDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const [joiningSlotId, setJoiningSlotId] = useState<string | null>(null);

  const matchQuery = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => getMe(),
    staleTime: 60_000,
  });

  // WS subscribe — every slot_update triggers a refetch of canonical detail.
  // Treating WS as a hint (not authoritative state) keeps a single source of
  // truth and dodges the trickier reconciliation cases (promote moves a
  // player between two slot ids).
  //
  // Gated on isSuccess so a 404'd detail (invite-only direct link, missing
  // match) doesn't fire a WS subscribe the gateway will reject.
  useEffect(() => {
    if (!matchId || !matchQuery.isSuccess) return;
    const unsubscribe = subscribeToMatch(matchId, () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    });
    return unsubscribe;
  }, [matchId, matchQuery.isSuccess, queryClient]);

  const joinMutation = useMutation({
    mutationFn: (slotId: string) => joinMatch(matchId, slotId),
    onMutate: (slotId) => {
      setJoiningSlotId(slotId);
    },
    onSettled: () => {
      setJoiningSlotId(null);
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null;
      if (apiErr?.status === 409) {
        Alert.alert(tr.common.error, tr.matchDetail.errors.conflict);
        return;
      }
      // Backend bubbles up a Turkish-friendly message in 400/locked cases
      // already; surface it directly when present, fall back otherwise.
      const backendMessage =
        apiErr &&
        typeof apiErr.body === 'object' &&
        apiErr.body !== null &&
        'message' in apiErr.body
          ? String((apiErr.body as { message: unknown }).message)
          : null;
      Alert.alert(
        tr.common.error,
        backendMessage ?? tr.matchDetail.errors.generic,
      );
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveMatch(matchId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null;
      const backendMessage =
        apiErr &&
        typeof apiErr.body === 'object' &&
        apiErr.body !== null &&
        'message' in apiErr.body
          ? String((apiErr.body as { message: unknown }).message)
          : null;
      Alert.alert(
        tr.common.error,
        backendMessage ?? tr.matchDetail.errors.generic,
      );
    },
  });

  const myUserId = meQuery.data?.id ?? null;
  const match = matchQuery.data;

  const myActiveSlot = useMemo<MatchSlot | null>(() => {
    if (!match || !myUserId) return null;
    const all = [...match.teamA, ...match.teamB];
    return (
      all.find(
        (s) => isIdentified(s.player) && s.player.userId === myUserId,
      ) ?? null
    );
  }, [match, myUserId]);

  const handleJoin = (slotId: string) => {
    if (joinMutation.isPending) return;
    joinMutation.mutate(slotId);
  };

  const handleLeavePress = () => {
    Alert.alert(tr.matchDetail.leave, tr.matchDetail.leaveConfirm, [
      { text: tr.matchDetail.no, style: 'cancel' },
      {
        text: tr.matchDetail.yes,
        style: 'destructive',
        onPress: () => leaveMutation.mutate(),
      },
    ]);
  };

  // ── Loading / error / not-found rendering ────────────────────
  if (!matchId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <NotFoundScreen onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (matchQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (matchQuery.isError) {
    const err = matchQuery.error;
    const apiErr = err instanceof ApiError ? err : null;
    if (apiErr?.status === 404) {
      return (
        <SafeAreaView className="flex-1 bg-gray-50">
          <NotFoundScreen onBack={() => router.back()} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView className="flex-1 bg-gray-50 p-4 gap-3">
        <BackHeader onBack={() => router.back()} />
        <View className="border-2 border-red-500 bg-red-100 rounded-lg p-3">
          <Text className="text-sm text-red-900">
            {tr.matchDetail.loadFailed}: {(err as Error).message}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <NotFoundScreen onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const blockReason = joinDisabledReason(match.state, match.isLocked);
  // Disable every empty slot while a join is in flight — prevents the user
  // from firing parallel mutations on different slots before the first
  // settles.
  const canJoin = !myActiveSlot && !blockReason && !joinMutation.isPending;

  const isOrganizer =
    !!myUserId &&
    (match.creatorId === myUserId || match.authorityId === myUserId);
  const canEdit =
    isOrganizer &&
    !['LIVE', 'RATING_WINDOW', 'CLOSED', 'CANCELLED'].includes(match.state);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerClassName="p-4 gap-3"
        refreshControl={
          <RefreshControl
            refreshing={matchQuery.isFetching && !matchQuery.isLoading}
            onRefresh={() => matchQuery.refetch()}
          />
        }>
        <View className="flex-row items-center justify-between">
          <BackHeader onBack={() => router.back()} />
          {canEdit ? (
            <Pressable
              onPress={() =>
                router.push(`/matches/${matchId}/edit` as Href)
              }
              className="flex-row items-center gap-1 active:opacity-60">
              <Ionicons name="create-outline" size={18} color="#2563eb" />
              <Text className="text-blue-600 font-semibold">
                {tr.common.edit}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold">
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
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600">
            {tr.matchDetail.capacity(
              match.capacity.filled,
              match.capacity.totalSlots,
            )}
          </Text>
          {match.pricePerPerson != null ? (
            <Text className="text-sm text-gray-600">
              {tr.matches.pricePerPerson(match.pricePerPerson)}
            </Text>
          ) : null}
        </View>
        <Text className="text-xs text-gray-500">
          {tr.matchDetail.organizer(match.createdBy)}
        </Text>

        {match.state === 'CANCELLED' ? (
          <View className="bg-red-100 border border-red-400 rounded-lg p-3">
            <Text className="text-sm text-red-900">
              {tr.matchDetail.cancelled}
            </Text>
          </View>
        ) : null}
        {match.isLocked && match.state !== 'CANCELLED' ? (
          <View className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
            <Text className="text-sm text-yellow-900">
              {tr.matchDetail.locked}
            </Text>
          </View>
        ) : null}

        <TeamSection
          label={tr.matchDetail.teamA}
          slots={match.teamA}
          myUserId={myUserId}
          joiningSlotId={joiningSlotId}
          canJoin={canJoin}
          onJoin={handleJoin}
        />
        <TeamSection
          label={tr.matchDetail.teamB}
          slots={match.teamB}
          myUserId={myUserId}
          joiningSlotId={joiningSlotId}
          canJoin={canJoin}
          onJoin={handleJoin}
        />

        {myActiveSlot ? (
          <Pressable
            disabled={leaveMutation.isPending}
            onPress={handleLeavePress}
            className="bg-red-600 rounded-lg p-3 mt-3 active:opacity-80">
            <Text className="text-center font-semibold text-white">
              {leaveMutation.isPending
                ? tr.matchDetail.leaving
                : tr.matchDetail.leave}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BackHeader({ onBack }: { onBack: () => void }) {
  return (
    <Pressable
      onPress={onBack}
      className="flex-row items-center gap-1 active:opacity-60">
      <Ionicons name="chevron-back" size={20} color="#2563eb" />
      <Text className="text-blue-600 font-semibold">{tr.matchDetail.back}</Text>
    </Pressable>
  );
}

function NotFoundScreen({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 p-4 gap-4">
      <BackHeader onBack={onBack} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg font-semibold text-gray-700">
          {tr.matchDetail.notFound}
        </Text>
      </View>
    </View>
  );
}
