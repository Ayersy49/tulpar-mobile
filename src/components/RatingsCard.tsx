// matchfinder-mobile/src/components/RatingsCard.tsx
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { UserRatings } from '../api/ratings';
import { tr } from '../i18n/tr';

type Props = {
  ratings: UserRatings | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
};

type AxisKey = keyof Pick<
  NonNullable<UserRatings['sportsmanship']>,
  | 'avgRespect'
  | 'avgSportsmanship'
  | 'avgSwearing'
  | 'avgAggression'
  | 'avgPunctuality'
>;

type AxisEntry = { key: AxisKey; label: string };

const AXES: AxisEntry[] = [
  { key: 'avgRespect', label: tr.ratingsCard.axisRespect },
  { key: 'avgSportsmanship', label: tr.ratingsCard.axisSportsmanship },
  { key: 'avgSwearing', label: tr.ratingsCard.axisSwearing },
  { key: 'avgAggression', label: tr.ratingsCard.axisAggression },
  { key: 'avgPunctuality', label: tr.ratingsCard.axisPunctuality },
];

function formatDisplay(d: number | '?'): string {
  return d === '?' ? tr.ratingsCard.notEnoughDataYet : d.toFixed(1);
}

export function RatingsCard({ ratings, isLoading, error, onRetry }: Props) {
  if (isLoading) {
    return (
      <View className="bg-gray-50 rounded-lg p-4 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-red-50 border border-red-200 rounded-lg p-4 gap-2">
        <Text className="text-sm text-red-800">
          {tr.ratingsCard.loadFailed}
        </Text>
        {onRetry ? (
          <Pressable
            className="bg-red-600 rounded-md px-3 py-2 self-start active:opacity-80"
            onPress={onRetry}>
            <Text className="text-white text-sm font-semibold">
              {tr.common.retry}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!ratings) return null;

  const hasPositions = ratings.positions.length > 0;
  const hasSportsmanship = ratings.sportsmanship !== null;

  if (!hasPositions && !hasSportsmanship) {
    return (
      <View className="bg-gray-50 rounded-lg p-4">
        <Text className="text-base font-semibold mb-1">
          {tr.ratingsCard.title}
        </Text>
        <Text className="text-sm text-gray-500">{tr.ratingsCard.empty}</Text>
      </View>
    );
  }

  return (
    <View className="bg-gray-50 rounded-lg p-4 gap-4">
      <Text className="text-base font-semibold">{tr.ratingsCard.title}</Text>

      {hasPositions ? (
        <View className="gap-2">
          <Text className="text-xs font-semibold text-gray-700 uppercase">
            {tr.ratingsCard.perPositionHeader}
          </Text>
          {ratings.positions.map((p) => (
            <View
              key={p.position}
              className="flex-row items-center justify-between">
              <Text className="text-sm font-medium">{p.position}</Text>
              <View className="items-end">
                <Text className="text-sm font-semibold">
                  {formatDisplay(p.display)}
                </Text>
                <Text className="text-[10px] text-gray-500">
                  {tr.ratingsCard.matches(p.matchCount)} ·{' '}
                  {tr.ratingsCard.raters(p.raterCount)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {hasSportsmanship && ratings.sportsmanship ? (
        <View className="gap-2">
          <Text className="text-xs font-semibold text-gray-700 uppercase">
            {tr.ratingsCard.sportsmanshipHeader}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium">SI</Text>
            <View className="items-end">
              <Text className="text-sm font-semibold">
                {formatDisplay(ratings.sportsmanship.display)}
              </Text>
              <Text className="text-[10px] text-gray-500">
                {tr.ratingsCard.raters(ratings.sportsmanship.raterCount)}
              </Text>
            </View>
          </View>
          {AXES.map(({ key, label }) => {
            const v = ratings.sportsmanship?.[key];
            if (v == null) return null;
            return (
              <View
                key={key}
                className="flex-row items-center justify-between pl-2">
                <Text className="text-xs text-gray-600">{label}</Text>
                <Text className="text-xs text-gray-600">{v.toFixed(1)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
