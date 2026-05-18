import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { getWdl } from '../api/users';
import { tr } from '../i18n/tr';

const COLOR: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-green-600',
  D: 'bg-gray-400',
  L: 'bg-red-600',
};

const LABEL: Record<'W' | 'D' | 'L', string> = {
  W: tr.wdl.win,
  D: tr.wdl.draw,
  L: tr.wdl.loss,
};

export function WdlStrip({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ['user-wdl', userId],
    queryFn: () => getWdl(userId),
    enabled: !!userId,
  });
  // Hide entirely when the user has no resolved series outcomes yet — the
  // strip should never appear with zero squares; an empty strip would look
  // like a render bug.
  if (!q.data || q.data.results.length === 0) return null;

  return (
    <View className="px-4 py-3 border-t border-gray-100">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-gray-700">
          {tr.wdl.stripHeader}
        </Text>
        <Text className="text-sm text-gray-600">
          {tr.wdl.summary(
            q.data.summary.wins,
            q.data.summary.draws,
            q.data.summary.losses,
          )}
        </Text>
      </View>
      <View className="flex-row gap-1">
        {q.data.results.map((r) => (
          <View
            key={r.matchId}
            className={`w-7 h-7 ${COLOR[r.result]} rounded items-center justify-center`}>
            <Text className="text-white text-xs font-bold">
              {LABEL[r.result]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
