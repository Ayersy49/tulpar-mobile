import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '../../../../src/api/client';
import {
  getMatch,
  type MatchDetail,
  type MatchSlot,
  type SlotPlayer,
} from '../../../../src/api/matches';
import { getMe } from '../../../../src/api/me';
import {
  getMyRatingsForMatch,
  submitRating,
  type MyRatingVote,
  type SubmitRatingPayload,
} from '../../../../src/api/ratings';
import { tr } from '../../../../src/i18n/tr';

const SPORTSMANSHIP_AXES = [
  'respect',
  'sportsmanship',
  'swearing',
  'aggression',
  'punctuality',
] as const;
type SportsmanshipAxis = (typeof SPORTSMANSHIP_AXES)[number];

type RatingAxis = 'performance' | SportsmanshipAxis;

type RatingDraft = {
  performance: number | null;
  respect: number | null;
  sportsmanship: number | null;
  swearing: number | null;
  aggression: number | null;
  punctuality: number | null;
};

const EMPTY_DRAFT: RatingDraft = {
  performance: null,
  respect: null,
  sportsmanship: null,
  swearing: null,
  aggression: null,
  punctuality: null,
};

type RateablePlayer = {
  userId: string;
  username: string | null;
  position: string;
  team: 'A' | 'B';
  isReserve: boolean;
};

function isIdentified(
  p: SlotPlayer | null,
): p is Extract<SlotPlayer, { userId: string }> {
  return !!p && 'userId' in p;
}

function buildRateablePlayers(
  match: MatchDetail,
  myUserId: string | null,
): RateablePlayer[] {
  const seen = new Set<string>();
  const rows: RateablePlayer[] = [];
  const collect = (slots: MatchSlot[], team: 'A' | 'B') => {
    for (const slot of slots) {
      if (!isIdentified(slot.player)) continue;
      if (slot.player.userId === myUserId) continue;
      if (seen.has(slot.player.userId)) continue;
      seen.add(slot.player.userId);
      rows.push({
        userId: slot.player.userId,
        username: slot.player.username,
        position: slot.position,
        team,
        isReserve: slot.isReserve,
      });
    }
  };
  collect(match.teamA, 'A');
  collect(match.teamB, 'B');
  return rows;
}

function voteToDraft(vote: MyRatingVote | undefined): RatingDraft {
  if (!vote) return { ...EMPTY_DRAFT };
  return {
    performance: vote.performance,
    respect: vote.respect,
    sportsmanship: vote.sportsmanship,
    swearing: vote.swearing,
    aggression: vote.aggression,
    punctuality: vote.punctuality,
  };
}

function isDirty(draft: RatingDraft, baseline: RatingDraft): boolean {
  return (
    draft.performance !== baseline.performance ||
    draft.respect !== baseline.respect ||
    draft.sportsmanship !== baseline.sportsmanship ||
    draft.swearing !== baseline.swearing ||
    draft.aggression !== baseline.aggression ||
    draft.punctuality !== baseline.punctuality
  );
}

function buildPatch(
  draft: RatingDraft,
  baseline: RatingDraft,
): Partial<SubmitRatingPayload> {
  // Only include fields whose value diverged from the baseline. Untouched
  // axes are omitted so the backend PATCH path leaves them as-is.
  const patch: Partial<SubmitRatingPayload> = {};
  if (draft.performance !== baseline.performance && draft.performance != null) {
    patch.performance = draft.performance;
  }
  if (draft.respect !== baseline.respect && draft.respect != null) {
    patch.respect = draft.respect;
  }
  if (
    draft.sportsmanship !== baseline.sportsmanship &&
    draft.sportsmanship != null
  ) {
    patch.sportsmanship = draft.sportsmanship;
  }
  if (draft.swearing !== baseline.swearing && draft.swearing != null) {
    patch.swearing = draft.swearing;
  }
  if (draft.aggression !== baseline.aggression && draft.aggression != null) {
    patch.aggression = draft.aggression;
  }
  if (draft.punctuality !== baseline.punctuality && draft.punctuality != null) {
    patch.punctuality = draft.punctuality;
  }
  return patch;
}

export default function MatchRateScreen() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const matchQuery = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId!),
    enabled: !!matchId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const myRatingsQuery = useQuery<MyRatingVote[]>({
    queryKey: ['match-ratings-me', matchId],
    queryFn: () => getMyRatingsForMatch(matchId!),
    enabled: !!matchId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const match = matchQuery.data;
  const myUserId = meQuery.data?.id ?? null;

  // myActiveSlot tells us if the viewer is an active participant — only
  // participants can rate. Stranger viewers (somehow deep-linked here) see
  // a polite hint.
  const myActiveSlot = useMemo(() => {
    if (!match || !myUserId) return null;
    for (const slot of [...match.teamA, ...match.teamB]) {
      if (isIdentified(slot.player) && slot.player.userId === myUserId) {
        return slot;
      }
    }
    return null;
  }, [match, myUserId]);

  const players = useMemo(
    () => (match ? buildRateablePlayers(match, myUserId) : []),
    [match, myUserId],
  );

  const baselines = useMemo<Map<string, RatingDraft>>(() => {
    const map = new Map<string, RatingDraft>();
    for (const player of players) {
      const vote = (myRatingsQuery.data ?? []).find(
        (v) => v.rateeUserId === player.userId,
      );
      map.set(player.userId, voteToDraft(vote));
    }
    return map;
  }, [players, myRatingsQuery.data]);

  const votesByRatee = useMemo<Map<string, MyRatingVote>>(() => {
    const map = new Map<string, MyRatingVote>();
    for (const vote of myRatingsQuery.data ?? []) {
      map.set(vote.rateeUserId, vote);
    }
    return map;
  }, [myRatingsQuery.data]);

  const [drafts, setDrafts] = useState<Map<string, RatingDraft>>(new Map());

  // Re-seed local drafts whenever baselines change (initial load, after a
  // save, after a refetch). Per-ratee drafts equal the baseline until the
  // user touches a chip/star.
  const lastSeededRef = useRef<string>('');
  useEffect(() => {
    const seedKey = JSON.stringify(
      [...baselines.entries()].map(([k, v]) => [k, v]),
    );
    if (seedKey === lastSeededRef.current) return;
    lastSeededRef.current = seedKey;
    const next = new Map<string, RatingDraft>();
    for (const [userId, draft] of baselines) {
      next.set(userId, { ...draft });
    }
    setDrafts(next);
  }, [baselines]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const [userId, draft] of drafts) {
      const baseline = baselines.get(userId) ?? EMPTY_DRAFT;
      if (isDirty(draft, baseline)) n += 1;
    }
    return n;
  }, [drafts, baselines]);

  const isClosed = match?.state === 'CLOSED';
  const isOpen = match?.state === 'RATING_WINDOW';
  const canEdit = isOpen && !!myActiveSlot;

  const [savingState, setSavingState] = useState<
    null | { current: number; total: number }
  >(null);

  const setAxisFor = useCallback(
    (userId: string, axis: RatingAxis, value: number) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const current = next.get(userId) ?? { ...EMPTY_DRAFT };
        next.set(userId, { ...current, [axis]: value });
        return next;
      });
    },
    [],
  );

  const handleSaveAll = useCallback(async () => {
    if (!matchId || dirtyCount === 0) return;
    const tasks: { userId: string; patch: Partial<SubmitRatingPayload> }[] = [];
    for (const [userId, draft] of drafts) {
      const baseline = baselines.get(userId) ?? EMPTY_DRAFT;
      if (!isDirty(draft, baseline)) continue;
      const patch = buildPatch(draft, baseline);
      // Sanity: backend requires at least one axis. buildPatch only includes
      // newly-set values, so if all the user did was unset (impossible in
      // the current UI but defensive) skip the POST.
      if (Object.keys(patch).length === 0) continue;
      tasks.push({ userId, patch });
    }
    if (tasks.length === 0) return;

    setSavingState({ current: 0, total: tasks.length });
    let okCount = 0;
    let failCount = 0;
    let firstError: string | null = null;

    for (let i = 0; i < tasks.length; i++) {
      const { userId, patch } = tasks[i];
      setSavingState({ current: i + 1, total: tasks.length });
      try {
        await submitRating(matchId, {
          rateeUserId: userId,
          ...patch,
        });
        okCount += 1;
      } catch (err) {
        failCount += 1;
        if (firstError == null) {
          const apiErr = err instanceof ApiError ? err : null;
          firstError =
            apiErr &&
            typeof apiErr.body === 'object' &&
            apiErr.body !== null &&
            'message' in apiErr.body
              ? String((apiErr.body as { message: unknown }).message)
              : tr.matchDetail.rating.saveFailed;
        }
      }
    }

    setSavingState(null);
    await queryClient.invalidateQueries({
      queryKey: ['match-ratings-me', matchId],
    });

    if (failCount === 0) {
      Alert.alert(tr.common.saved, tr.matchDetail.rating.saved);
    } else if (okCount === 0) {
      Alert.alert(
        tr.common.error,
        firstError ?? tr.matchDetail.rating.saveFailed,
      );
    } else {
      Alert.alert(
        tr.common.error,
        tr.matchDetail.rating.partialSuccess(okCount, failCount),
      );
    }
  }, [matchId, dirtyCount, drafts, baselines, queryClient]);

  if (!matchId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <Text className="p-4 text-red-700">{tr.matchDetail.errors.generic}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 active:opacity-60">
          <Ionicons name="chevron-back" size={20} color="#2563eb" />
          <Text className="text-blue-600 font-semibold">
            {tr.matchDetail.rating.back}
          </Text>
        </Pressable>
        <Text className="text-base font-bold">
          {tr.matchDetail.rating.title}
        </Text>
        <View style={{ width: 56 }} />
      </View>

      {matchQuery.isLoading || myRatingsQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : matchQuery.isError ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-sm text-red-700">
            {tr.matchDetail.errors.generic}
          </Text>
        </View>
      ) : !match ? null : !myActiveSlot ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-sm text-gray-700 text-center">
            {tr.matchDetail.rating.notParticipant}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 gap-3 pb-32"
          refreshControl={
            <RefreshControl
              refreshing={
                matchQuery.isFetching || myRatingsQuery.isFetching
              }
              onRefresh={() => {
                matchQuery.refetch();
                myRatingsQuery.refetch();
              }}
            />
          }>
          <View className="border border-blue-200 bg-blue-50 rounded-lg p-3 gap-1">
            <Text className="text-sm font-semibold text-blue-900">
              {isClosed
                ? tr.matchDetail.rating.closedHint
                : tr.matchDetail.rating.hint}
            </Text>
            {!isClosed ? (
              <Text className="text-xs text-blue-800">
                {tr.matchDetail.rating.optionalHint}
              </Text>
            ) : null}
          </View>

          {players.length === 0 ? (
            <Text className="text-sm text-gray-500 italic">
              {tr.matchDetail.rating.empty}
            </Text>
          ) : (
            players.map((player) => {
              const baseline = baselines.get(player.userId) ?? EMPTY_DRAFT;
              const draft = drafts.get(player.userId) ?? baseline;
              const vote = votesByRatee.get(player.userId);
              const dirty = isDirty(draft, baseline);
              const editsExhausted = !!vote && vote.editsLeft <= 0;
              const disabled =
                !canEdit || editsExhausted || savingState !== null;
              return (
                <RatingCard
                  key={player.userId}
                  player={player}
                  draft={draft}
                  vote={vote ?? null}
                  dirty={dirty}
                  disabled={disabled}
                  onChange={(axis, value) =>
                    setAxisFor(player.userId, axis, value)
                  }
                />
              );
            })
          )}
        </ScrollView>
      )}

      {canEdit && myActiveSlot && players.length > 0 ? (
        <View
          style={{ paddingBottom: 12 }}
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3">
          {savingState ? (
            <View className="flex-row items-center justify-center gap-2 py-3">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-sm text-gray-700">
                {tr.matchDetail.rating.savingProgress(
                  savingState.current,
                  savingState.total,
                )}
              </Text>
            </View>
          ) : (
            <Pressable
              disabled={dirtyCount === 0}
              onPress={handleSaveAll}
              className={`rounded-lg p-3 ${
                dirtyCount === 0 ? 'bg-blue-300' : 'bg-blue-600'
              } active:opacity-80`}>
              <Text className="text-center font-semibold text-white">
                {dirtyCount === 0
                  ? tr.matchDetail.rating.nothingDirty
                  : tr.matchDetail.rating.saveAllWithCount(dirtyCount)}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

type RatingCardProps = {
  player: RateablePlayer;
  draft: RatingDraft;
  vote: MyRatingVote | null;
  dirty: boolean;
  disabled: boolean;
  onChange: (axis: RatingAxis, value: number) => void;
};

function RatingCard({
  player,
  draft,
  vote,
  dirty,
  disabled,
  onChange,
}: RatingCardProps) {
  const username = player.username ?? '—';
  return (
    <View
      className={`border rounded-lg p-3 gap-3 bg-white ${
        dirty ? 'border-blue-400' : 'border-gray-200'
      }`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-gray-900">{username}</Text>
          <Text className="text-xs text-gray-500">
            {tr.matchDetail.rating.playerMeta(
              player.team,
              player.position,
              player.isReserve,
            )}
          </Text>
        </View>
        <View className="items-end gap-1">
          {vote ? (
            <Text className="text-xs text-gray-500">
              {tr.matchDetail.rating.editsLeft(vote.editsLeft)}
            </Text>
          ) : null}
          {dirty ? (
            <View className="bg-blue-100 border border-blue-300 rounded px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-blue-800">
                {tr.matchDetail.rating.dirty}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScorePicker
        label={tr.matchDetail.rating.performance}
        value={draft.performance}
        disabled={disabled}
        onChange={(v) => onChange('performance', v)}
      />

      <View className="gap-2">
        <Text className="text-xs font-semibold text-gray-600 uppercase">
          {tr.matchDetail.rating.sportsmanshipTitle}
        </Text>
        {SPORTSMANSHIP_AXES.map((axis) => (
          <StarPicker
            key={axis}
            label={tr.matchDetail.rating.axes[axis]}
            value={draft[axis]}
            disabled={disabled}
            onChange={(v) => onChange(axis, v)}
          />
        ))}
      </View>

      {disabled && vote && vote.editsLeft <= 0 ? (
        <Text className="text-xs text-gray-500">
          {tr.matchDetail.rating.editLimitReached}
        </Text>
      ) : null}
    </View>
  );
}

type ScorePickerProps = {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
};

function ScorePicker({ label, value, disabled, onChange }: ScorePickerProps) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-semibold text-gray-600 uppercase">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              disabled={disabled}
              onPress={() => onChange(n)}
              className={`w-8 h-8 rounded border items-center justify-center ${
                selected
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-gray-300'
              } ${disabled ? 'opacity-50' : 'active:opacity-70'}`}>
              <Text
                className={`text-xs font-semibold ${
                  selected ? 'text-white' : 'text-gray-700'
                }`}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type StarPickerProps = {
  label: string;
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
};

function StarPicker({ label, value, disabled, onChange }: StarPickerProps) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-xs text-gray-700 flex-1">{label}</Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = value != null && value >= n;
          return (
            <Pressable
              key={n}
              disabled={disabled}
              onPress={() => onChange(n)}
              className={`p-0.5 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}>
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={20}
                color={filled ? '#f59e0b' : '#9ca3af'}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
