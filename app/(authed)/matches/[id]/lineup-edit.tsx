import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { getMatch, type MatchDetail, type MatchSlot } from '../../../../src/api/matches';
import {
  editLineup,
  type LineupEntry,
} from '../../../../src/api/series-instances';
import { tr } from '../../../../src/i18n/tr';

type SlotKey = `${'A' | 'B'}:${number}`;

// A "row" maps 1:1 to an original MatchSlot. The user re-arranges which
// userId sits in which row via tap-to-pick/tap-to-drop. The local map is the
// editable source of truth; the server only sees the diff when we POST.
type Row = {
  key: SlotKey;
  team: 'A' | 'B';
  position: string | null;
  isReserve: boolean;
};

function buildRows(match: MatchDetail): {
  rows: Row[];
  initialAssignment: Map<SlotKey, string | null>;
} {
  const rows: Row[] = [];
  const initialAssignment = new Map<SlotKey, string | null>();
  const addCol = (team: 'A' | 'B', slots: MatchSlot[]) => {
    slots.forEach((s, i) => {
      const key: SlotKey = `${team}:${i}`;
      rows.push({
        key,
        team,
        position: s.isReserve ? null : s.position,
        isReserve: s.isReserve,
      });
      const userId =
        s.player && 'userId' in s.player ? s.player.userId : null;
      initialAssignment.set(key, userId);
    });
  };
  addCol('A', match.teamA);
  addCol('B', match.teamB);
  return { rows, initialAssignment };
}

function displayUsername(match: MatchDetail, userId: string | null): string {
  if (!userId) return tr.lineupEdit.emptySlot;
  const all = [...match.teamA, ...match.teamB];
  for (const slot of all) {
    if (slot.player && 'userId' in slot.player && slot.player.userId === userId) {
      return slot.player.username ?? userId.slice(0, 8);
    }
  }
  return userId.slice(0, 8);
}

export default function LineupEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });

  const { rows, initialAssignment } = useMemo(() => {
    if (!matchQuery.data) {
      return { rows: [] as Row[], initialAssignment: new Map<SlotKey, string | null>() };
    }
    return buildRows(matchQuery.data);
  }, [matchQuery.data]);

  // `assignment` is the live editable mapping from slot key → userId. Starts
  // as a copy of `initialAssignment`; rebuilds whenever the match payload
  // refreshes (e.g., after a successful save we navigate back, so a stale
  // assignment shouldn't ever leak across edits).
  const [assignment, setAssignment] = useState<Map<SlotKey, string | null>>(
    () => new Map(),
  );
  useEffect(() => {
    setAssignment(new Map(initialAssignment));
  }, [initialAssignment]);

  // Pick-up state: the slot key whose player is "in hand". null = no pickup.
  const [picked, setPicked] = useState<SlotKey | null>(null);

  // Diff against original assignment to drive the change counter + save gate.
  // Computed unconditionally so the hook order stays stable across the early
  // returns below.
  const changeCount = useMemo(() => {
    let count = 0;
    initialAssignment.forEach((origUserId, key) => {
      if ((assignment.get(key) ?? null) !== origUserId) count += 1;
    });
    return count;
  }, [assignment, initialAssignment]);

  const saveMut = useMutation({
    mutationFn: () => {
      const lineup: LineupEntry[] = [];
      rows.forEach((row) => {
        const userId = assignment.get(row.key) ?? null;
        // Skip empty slots — backend derives slot mapping from position +
        // team + isReserve; rows we don't include are absent participants.
        if (!userId) return;
        lineup.push({
          userId,
          team: row.team,
          position: row.isReserve ? null : row.position,
          isReserve: row.isReserve,
        });
      });
      return editLineup(matchId, lineup);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['match', matchId] });
      Alert.alert('', tr.lineupEdit.saved);
      router.back();
    },
    onError: (e: Error) =>
      Alert.alert(tr.lineupEdit.saveFailed, e.message),
  });

  if (matchQuery.isLoading || !matchQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  const match = matchQuery.data;
  if (!match.seriesId || match.state !== 'LOCKED' || !match.series) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-4">
        <Text className="text-sm text-gray-700 text-center">
          Bu maç düzenlenemez.
        </Text>
      </SafeAreaView>
    );
  }
  const isFixed = match.series.teamMode === 'FIXED';
  const pickedRow = picked ? rows.find((r) => r.key === picked) ?? null : null;

  const handleTap = (row: Row) => {
    const currentUserId = assignment.get(row.key) ?? null;
    if (!picked) {
      // Only allow picking up filled slots.
      if (!currentUserId) return;
      setPicked(row.key);
      return;
    }
    if (picked === row.key) {
      // Tap the same slot to cancel pickup.
      setPicked(null);
      return;
    }
    if (isFixed && pickedRow && pickedRow.team !== row.team) {
      Alert.alert('', tr.lineupEdit.crossTeamBlocked);
      return;
    }
    // Swap (or move into empty). Both single-direction (empty → filled) and
    // straight swaps go through the same code path.
    const pickedUserId = assignment.get(picked) ?? null;
    const targetUserId = assignment.get(row.key) ?? null;
    const next = new Map(assignment);
    next.set(picked, targetUserId);
    next.set(row.key, pickedUserId);
    setAssignment(next);
    setPicked(null);
  };

  const renderRow = (row: Row) => {
    const userId = assignment.get(row.key) ?? null;
    const isPicked = picked === row.key;
    const otherTeamDimmed =
      picked !== null && isFixed && pickedRow && pickedRow.team !== row.team;
    const label = row.isReserve
      ? tr.lineupEdit.reservesHeader
      : row.position ?? '?';
    return (
      <Pressable
        key={row.key}
        onPress={() => handleTap(row)}
        disabled={!!otherTeamDimmed}
        className={`px-3 py-2 rounded border mb-2 ${
          isPicked
            ? 'border-blue-600 bg-blue-50'
            : otherTeamDimmed
              ? 'border-gray-200 bg-gray-50 opacity-50'
              : 'border-gray-200 bg-white'
        } active:opacity-70`}>
        <Text className="text-xs text-gray-500">{label}</Text>
        <Text className="text-sm font-medium text-gray-900 mt-0.5">
          {displayUsername(match, userId)}
        </Text>
      </Pressable>
    );
  };

  const teamARows = rows.filter((r) => r.team === 'A');
  const teamBRows = rows.filter((r) => r.team === 'B');

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-1 active:opacity-60">
          <Ionicons name="chevron-back" size={18} color="#2563eb" />
          <Text className="text-blue-600">{tr.matchDetail.back}</Text>
        </Pressable>
        <Text className="text-base font-semibold">{tr.lineupEdit.title}</Text>
        <View style={{ width: 56 }} />
      </View>
      <Text className="px-4 py-2 text-xs text-gray-500">
        {tr.lineupEdit.pickHint}
      </Text>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold mb-2 text-gray-700">A</Text>
            {teamARows.map(renderRow)}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold mb-2 text-gray-700">B</Text>
            {teamBRows.map(renderRow)}
          </View>
        </View>
      </ScrollView>
      <View className="px-4 py-3 border-t border-gray-100 bg-white">
        <Pressable
          onPress={() => saveMut.mutate()}
          disabled={changeCount === 0 || saveMut.isPending}
          className={`py-3 rounded ${
            changeCount === 0 || saveMut.isPending
              ? 'bg-gray-300'
              : 'bg-blue-600'
          } active:opacity-80`}>
          <Text className="text-white text-center font-medium">
            {saveMut.isPending
              ? tr.lineupEdit.saving
              : tr.lineupEdit.saveSummary(changeCount)}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
