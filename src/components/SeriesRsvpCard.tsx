import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { submitRsvp } from '../api/series-instances';
import { tr } from '../i18n/tr';

type Props = {
  matchId: string;
  scheduledAt: string;
  // null means the viewer is not a pool member; the card is hidden in that
  // case (we mainly render for COMING/NOT_COMING/NO_ANSWER pool members).
  myRsvpStatus: 'COMING' | 'NOT_COMING' | null;
  counts: { coming: number; notComing: number; noAnswer: number };
};

// 2-hour-before-kickoff lock window — mirrors the backend deadline cron.
// Pure presentation; the actual lock authority is server-side, this just
// disables the buttons so the UX doesn't surface a confusing failed POST.
const DEADLINE_OFFSET_MS = 2 * 60 * 60 * 1000;

export function SeriesRsvpCard({
  matchId,
  scheduledAt,
  myRsvpStatus,
  counts,
}: Props) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // 30s tick covers countdown granularity (minutes) without burning battery.
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const kickoffMs = new Date(scheduledAt).getTime();
  const deadlineMs = kickoffMs - DEADLINE_OFFSET_MS;
  const msToDeadline = deadlineMs - now;
  const deadlinePassed = msToDeadline <= 0;
  const hToDeadline = Math.floor(msToDeadline / 3_600_000);
  const minToDeadline = Math.floor((msToDeadline % 3_600_000) / 60_000);

  // Format preview mirrors the backend's deterministic format computation:
  // floor(coming / 2), capped at 11v11. Below 10 confirms the system can't
  // open a match (5v5 minimum * 2 teams = 10 starters).
  const formatPreview =
    counts.coming >= 10
      ? Math.min(11, Math.floor(counts.coming / 2))
      : null;

  const mut = useMutation({
    mutationFn: (status: 'COMING' | 'NOT_COMING') =>
      submitRsvp(matchId, status),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['match', matchId] }),
    onError: () => Alert.alert(tr.seriesRsvp.confirmingError),
  });

  return (
    <View className="p-4 bg-blue-50 border-b border-blue-200">
      <Text className="text-base font-semibold mb-2 text-gray-900">
        {tr.seriesRsvp.headerQuestion}
      </Text>
      <View className="flex-row gap-2 mb-3">
        <Pressable
          disabled={deadlinePassed || mut.isPending}
          onPress={() => mut.mutate('COMING')}
          className={`flex-1 py-2 rounded ${
            myRsvpStatus === 'COMING'
              ? 'bg-green-600'
              : 'bg-white border border-green-600'
          } ${deadlinePassed ? 'opacity-60' : 'active:opacity-80'}`}>
          <Text
            className={`text-center font-medium ${
              myRsvpStatus === 'COMING' ? 'text-white' : 'text-green-700'
            }`}>
            ✓ {tr.seriesRsvp.coming}
          </Text>
        </Pressable>
        <Pressable
          disabled={deadlinePassed || mut.isPending}
          onPress={() => mut.mutate('NOT_COMING')}
          className={`flex-1 py-2 rounded ${
            myRsvpStatus === 'NOT_COMING'
              ? 'bg-red-600'
              : 'bg-white border border-red-600'
          } ${deadlinePassed ? 'opacity-60' : 'active:opacity-80'}`}>
          <Text
            className={`text-center font-medium ${
              myRsvpStatus === 'NOT_COMING' ? 'text-white' : 'text-red-700'
            }`}>
            ✗ {tr.seriesRsvp.notComing}
          </Text>
        </Pressable>
      </View>
      <Text className="text-xs text-gray-700">
        {deadlinePassed
          ? tr.seriesRsvp.deadlinePassed
          : hToDeadline > 0
            ? tr.seriesRsvp.deadlineCountdown(hToDeadline, minToDeadline)
            : tr.seriesRsvp.deadlineUrgent(minToDeadline)}
      </Text>
      <Text className="text-xs text-gray-600 mt-1">
        {tr.seriesRsvp.counts(counts.coming, counts.notComing, counts.noAnswer)}
      </Text>
      <Text className="text-xs text-gray-600 mt-2 italic">
        {formatPreview
          ? tr.seriesRsvp.formatPreview(formatPreview)
          : tr.seriesRsvp.formatPreviewCancelled}
      </Text>
    </View>
  );
}
