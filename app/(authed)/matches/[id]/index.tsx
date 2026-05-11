import { useEffect, useMemo, useRef, useState } from 'react';
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
  approveRequest,
  getMatch,
  joinMatch,
  leaveMatch,
  listRequests,
  rejectRequest,
  requestAccess,
  type MatchDetail,
  type MatchRequest,
  type MatchSlot,
  type SlotPlayer,
} from '../../../../src/api/matches';
import { getMe, type MeResponse } from '../../../../src/api/me';
import {
  subscribeToMatch,
  subscribeToUserEvents,
} from '../../../../src/lib/socket';
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

// P2.M1: state pill color map. CANCELLED keeps the banner-only treatment.
const STATE_PILL_STYLES: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-700' },
  OPEN: { bg: 'bg-green-100 border-green-300', text: 'text-green-900' },
  LOCKED: { bg: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-900' },
  LIVE: { bg: 'bg-red-100 border-red-400', text: 'text-red-900' },
  RATING_WINDOW: { bg: 'bg-blue-100 border-blue-400', text: 'text-blue-900' },
  CLOSED: { bg: 'bg-gray-200 border-gray-400', text: 'text-gray-800' },
};

function StatePill({ state }: { state: string }) {
  if (state === 'CANCELLED') return null;
  const label = tr.matchDetail.stateLabels[state] ?? state;
  const style = STATE_PILL_STYLES[state] ?? STATE_PILL_STYLES.DRAFT;
  return (
    <View className={`${style.bg} border rounded px-2 py-0.5`}>
      <Text className={`text-xs font-medium ${style.text}`}>{label}</Text>
    </View>
  );
}

function lifecycleCountdownText(
  match: MatchDetail,
  now: number,
): string | null {
  const startMs = match.liveAt ? new Date(match.liveAt).getTime() : null;
  const endMs = match.ratingWindowOpensAt
    ? new Date(match.ratingWindowOpensAt).getTime()
    : null;
  const ratingEndsMs = match.ratingWindowClosesAt
    ? new Date(match.ratingWindowClosesAt).getTime()
    : null;

  if (
    (match.state === 'OPEN' || match.state === 'LOCKED') &&
    startMs &&
    startMs > now
  ) {
    return tr.matchDetail.countdown.startsIn(
      tr.matchDetail.countdown.format(startMs - now),
    );
  }
  if (match.state === 'LIVE' && endMs) {
    return tr.matchDetail.countdown.liveEndsIn(
      tr.matchDetail.countdown.format(endMs - now),
    );
  }
  if (match.state === 'RATING_WINDOW' && ratingEndsMs) {
    return tr.matchDetail.countdown.ratingEndsIn(
      tr.matchDetail.countdown.format(ratingEndsMs - now),
    );
  }
  return null;
}

function joinDisabledReason(
  state: string,
  isLocked: boolean,
  isOrganizer: boolean,
): string | null {
  // Organizers (creator + authority) bypass the locked-join guard — they run
  // the match and the backend lets them join directly. UI must mirror that
  // bypass so the empty slot is tappable.
  if (isLocked && !isOrganizer) return tr.matchDetail.errors.lockedJoin;
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

  // P2.M1: tick once a minute for the lifecycle countdown text. Re-renders
  // keep the "Başlamasına 1sa 35dk kaldı" string fresh without spamming
  // the network — the WS match:state_change listener handles real state flips.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const matchQuery = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
    // Re-opening the detail screen must always fetch fresh state. The 30s
    // global staleTime would otherwise hide changes made by the organizer
    // (approve / reject / cancel) that this account didn't trigger locally
    // — the user would see a stale screen and have to pull-to-refresh.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => getMe(),
    staleTime: 60_000,
  });

  const myUserId = meQuery.data?.id ?? null;
  const match = matchQuery.data;
  const isOrganizer =
    !!myUserId &&
    !!match &&
    (match.creatorId === myUserId || match.authorityId === myUserId);
  const showRequestsPanel =
    !!match && match.isLocked && isOrganizer && match.state !== 'CANCELLED';

  const requestsQuery = useQuery<MatchRequest[]>({
    queryKey: ['match-requests', matchId],
    queryFn: () => listRequests(matchId),
    enabled: showRequestsPanel,
    // Authority opens the panel and expects to see the latest pending list —
    // staleTime 0 keeps it fresh on every focus / WS-triggered invalidate.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // M4.B: live nudge for the organizer's pending panel. The backend emits
  // `match:request_created` to authority + creator user rooms when a new
  // request lands — invalidate so the panel refetches without pull-to-refresh.
  useEffect(() => {
    if (!showRequestsPanel) return;
    return subscribeToUserEvents('match:request_created', (payload) => {
      // Filter to this match — the user-room is per-user, not per-match,
      // so the same event fires for every match they organize.
      if (
        payload &&
        typeof payload === 'object' &&
        'matchId' in payload &&
        (payload as { matchId: string }).matchId !== matchId
      ) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['match-requests', matchId] });
    });
  }, [showRequestsPanel, matchId, queryClient]);

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

  // M4.B: send a join request for a locked match. The match detail refetch
  // (onSettled) will surface the new myRequestStatus = 'PENDING' so the
  // requester CTA flips to its disabled "İstek beklemede" state.
  const requestMutation = useMutation({
    mutationFn: () =>
      requestAccess(matchId, {
        preferredPosition: meQuery.data?.profile?.position1 ?? undefined,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
    onError: (err) => {
      const apiErr = err instanceof ApiError ? err : null;
      if (apiErr?.status === 409) {
        Alert.alert(tr.common.error, tr.matchDetail.errors.requestExists);
        return;
      }
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

  // Organizer mutations on the pending requests panel. Approve also fills a
  // slot (backend auto-assigns via findAvailableSlot), so we invalidate the
  // match detail in addition to the requests list.
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveRequest(matchId, requestId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['match-requests', matchId] });
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

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => rejectRequest(matchId, requestId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['match-requests', matchId] });
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

  const myActiveSlot = useMemo<MatchSlot | null>(() => {
    if (!match || !myUserId) return null;
    const all = [...match.teamA, ...match.teamB];
    return (
      all.find(
        (s) => isIdentified(s.player) && s.player.userId === myUserId,
      ) ?? null
    );
  }, [match, myUserId]);

  // M4.C: surface a 2-second toast when the viewer is promoted from reserve
  // to starter. Detect on the `myActiveSlot.isReserve` true → false edge so
  // we never fire on initial mount (when prev is null) or on a starter join
  // (where prev was null and current is false).
  const [showPromotedToast, setShowPromotedToast] = useState(false);
  const prevIsReserveRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!myActiveSlot) {
      // Reset on leave so a future re-join into a reserve slot starts clean.
      prevIsReserveRef.current = null;
      return;
    }
    const wasReserve = prevIsReserveRef.current;
    const isReserve = myActiveSlot.isReserve;
    prevIsReserveRef.current = isReserve;
    if (wasReserve === true && isReserve === false) {
      setShowPromotedToast(true);
      const timer = setTimeout(() => setShowPromotedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [myActiveSlot]);

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

  const handleSendRequestPress = () => {
    Alert.alert(tr.matchDetail.sendRequest, tr.matchDetail.requestConfirm, [
      { text: tr.matchDetail.no, style: 'cancel' },
      {
        text: tr.matchDetail.yes,
        onPress: () => requestMutation.mutate(),
      },
    ]);
  };

  const handleApprovePress = (request: MatchRequest) => {
    const name = request.user.username ?? '—';
    Alert.alert(tr.matchRequests.approve, tr.matchRequests.confirmApprove(name), [
      { text: tr.matchDetail.no, style: 'cancel' },
      { text: tr.matchDetail.yes, onPress: () => approveMutation.mutate(request.id) },
    ]);
  };

  const handleRejectPress = (request: MatchRequest) => {
    const name = request.user.username ?? '—';
    Alert.alert(tr.matchRequests.reject, tr.matchRequests.confirmReject(name), [
      { text: tr.matchDetail.no, style: 'cancel' },
      {
        text: tr.matchDetail.yes,
        style: 'destructive',
        onPress: () => rejectMutation.mutate(request.id),
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

  const canEdit =
    isOrganizer &&
    !['LIVE', 'RATING_WINDOW', 'CLOSED', 'CANCELLED'].includes(match.state);

  const blockReason = joinDisabledReason(
    match.state,
    match.isLocked,
    isOrganizer,
  );
  // Disable every empty slot while a join is in flight — prevents the user
  // from firing parallel mutations on different slots before the first
  // settles.
  const canJoin = !myActiveSlot && !blockReason && !joinMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {showPromotedToast ? (
        <View
          pointerEvents="none"
          className="absolute top-12 left-4 right-4 z-50 bg-green-600 rounded-lg p-3 shadow-lg">
          <Text className="text-center font-semibold text-white">
            {tr.matchDetail.promoted}
          </Text>
        </View>
      ) : null}
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
          <View className="flex-row items-center gap-1">
            <StatePill state={match.state} />
            {match.isLocked && match.state !== 'LOCKED' ? (
              <View className="bg-yellow-100 border border-yellow-400 rounded px-2 py-0.5">
                <Text className="text-xs font-medium text-yellow-900">
                  {tr.matchDetail.stateLabels.LOCKED}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {(() => {
          const text = lifecycleCountdownText(match, now);
          return text ? (
            <Text className="text-xs italic text-gray-500">{text}</Text>
          ) : null;
        })()}

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
              {isOrganizer
                ? tr.matchDetail.lockedOrganizer
                : tr.matchDetail.locked}
            </Text>
          </View>
        ) : null}

        {showRequestsPanel ? (
          <PendingRequestsSection
            query={requestsQuery}
            approvingId={
              approveMutation.isPending
                ? (approveMutation.variables as string | undefined) ?? null
                : null
            }
            rejectingId={
              rejectMutation.isPending
                ? (rejectMutation.variables as string | undefined) ?? null
                : null
            }
            onApprove={handleApprovePress}
            onReject={handleRejectPress}
          />
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

        {/* M4.B requester CTA: locked match, viewer is not in the squad and
            isn't the organizer. The single full-width button replaces per-slot
            join (organizer auto-assigns the slot on approval). */}
        {match.isLocked &&
        !isOrganizer &&
        !myActiveSlot &&
        match.state !== 'CANCELLED' ? (
          <RequestAccessCta
            status={match.myRequestStatus}
            isPending={requestMutation.isPending}
            onPress={handleSendRequestPress}
          />
        ) : null}

        {/* M5: chat entry — only active participants of the match (backend
            requires matchParticipant with leftAt: null, no organizer bypass)
            and only while chat is open (DRAFT/CANCELLED/CLOSED return 400). */}
        {myActiveSlot &&
        ['OPEN', 'LOCKED', 'LIVE', 'RATING_WINDOW'].includes(match.state) ? (
          <Pressable
            onPress={() => router.push(`/matches/${matchId}/chat` as Href)}
            className="flex-row items-center justify-center gap-2 bg-white border border-blue-500 rounded-lg p-3 mt-3 active:opacity-70">
            <Ionicons name="chatbubbles-outline" size={18} color="#2563eb" />
            <Text className="text-center font-semibold text-blue-600">
              {tr.chat.open}
            </Text>
          </Pressable>
        ) : null}

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

type RequestAccessCtaProps = {
  status: MatchDetail['myRequestStatus'];
  isPending: boolean;
  onPress: () => void;
};

function RequestAccessCta({ status, isPending, onPress }: RequestAccessCtaProps) {
  if (status === 'PENDING') {
    return (
      <View className="bg-gray-200 rounded-lg p-3 mt-3">
        <Text className="text-center font-semibold text-gray-700">
          {tr.matchDetail.requestPending}
        </Text>
      </View>
    );
  }
  const label = isPending
    ? tr.matchDetail.sendingRequest
    : tr.matchDetail.sendRequest;
  return (
    <View className="gap-2 mt-3">
      {status === 'REJECTED' ? (
        <Text className="text-xs text-red-700 text-center">
          {tr.matchDetail.requestRejected}
        </Text>
      ) : null}
      <Pressable
        disabled={isPending}
        onPress={onPress}
        className="bg-blue-600 rounded-lg p-3 active:opacity-80">
        <Text className="text-center font-semibold text-white">{label}</Text>
      </Pressable>
    </View>
  );
}

type PendingRequestsSectionProps = {
  query: ReturnType<typeof useQuery<MatchRequest[]>>;
  approvingId: string | null;
  rejectingId: string | null;
  onApprove: (request: MatchRequest) => void;
  onReject: (request: MatchRequest) => void;
};

function PendingRequestsSection({
  query,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: PendingRequestsSectionProps) {
  const requests = query.data ?? [];
  return (
    <View className="border border-gray-200 rounded-lg p-3 bg-white gap-2">
      <Text className="text-base font-bold">
        {tr.matchRequests.title(requests.length)}
      </Text>
      {query.isLoading ? (
        <ActivityIndicator />
      ) : query.isError ? (
        <Text className="text-sm text-red-700">
          {tr.matchRequests.loadFailed}
        </Text>
      ) : requests.length === 0 ? (
        <Text className="text-sm text-gray-500 italic">
          {tr.matchRequests.empty}
        </Text>
      ) : (
        requests.map((req) => (
          <PendingRequestRow
            key={req.id}
            request={req}
            isApproving={approvingId === req.id}
            isRejecting={rejectingId === req.id}
            disableActions={
              !!approvingId || !!rejectingId
            }
            onApprove={() => onApprove(req)}
            onReject={() => onReject(req)}
          />
        ))
      )}
    </View>
  );
}

type PendingRequestRowProps = {
  request: MatchRequest;
  isApproving: boolean;
  isRejecting: boolean;
  disableActions: boolean;
  onApprove: () => void;
  onReject: () => void;
};

function PendingRequestRow({
  request,
  isApproving,
  isRejecting,
  disableActions,
  onApprove,
  onReject,
}: PendingRequestRowProps) {
  const username = request.user.username ?? '—';
  const positionsLine = tr.matchRequests.profilePositions(
    request.user.positions,
  );
  return (
    <View className="border border-gray-200 rounded-lg p-2 gap-1">
      <Text className="text-sm font-semibold text-gray-900">{username}</Text>
      <Text className="text-xs text-gray-600">{positionsLine}</Text>
      {request.preferredPosition ? (
        <Text className="text-xs text-gray-600">
          {tr.matchRequests.preferredPosition(request.preferredPosition)}
        </Text>
      ) : null}
      <View className="flex-row gap-2 mt-1">
        <Pressable
          disabled={disableActions}
          onPress={onApprove}
          className={`flex-1 rounded-md p-2 ${
            disableActions ? 'bg-green-300' : 'bg-green-600'
          } active:opacity-80`}>
          <Text className="text-center text-white font-semibold text-sm">
            {isApproving ? tr.matchRequests.approving : tr.matchRequests.approve}
          </Text>
        </Pressable>
        <Pressable
          disabled={disableActions}
          onPress={onReject}
          className={`flex-1 rounded-md p-2 border ${
            disableActions
              ? 'border-red-300 bg-white'
              : 'border-red-500 bg-white'
          } active:opacity-80`}>
          <Text
            className={`text-center font-semibold text-sm ${
              disableActions ? 'text-red-300' : 'text-red-600'
            }`}>
            {isRejecting ? tr.matchRequests.rejecting : tr.matchRequests.reject}
          </Text>
        </Pressable>
      </View>
    </View>
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
