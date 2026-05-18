import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  reportOutcome,
  type ReportableOutcome,
} from '../api/match-outcomes';
import { tr } from '../i18n/tr';

type Props = {
  matchId: string;
  alreadyReported: boolean;
  officialOutcome: 'A' | 'B' | 'DRAW' | null;
};

const OPTIONS: { value: ReportableOutcome; labelKey: 'optionA' | 'optionB' | 'optionDraw' }[] = [
  { value: 'A', labelKey: 'optionA' },
  { value: 'B', labelKey: 'optionB' },
  { value: 'DRAW', labelKey: 'optionDraw' },
];

export function OutcomeReportCard({
  matchId,
  alreadyReported,
  officialOutcome,
}: Props) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (o: ReportableOutcome) => reportOutcome(matchId, o),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['match', matchId] });
      qc.invalidateQueries({ queryKey: ['user-wdl'] });
      Alert.alert('', tr.outcome.submitted);
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });

  if (officialOutcome) {
    const label =
      officialOutcome === 'A'
        ? tr.outcome.resolvedA
        : officialOutcome === 'B'
          ? tr.outcome.resolvedB
          : tr.outcome.resolvedDraw;
    return (
      <View className="p-4 bg-green-50 border-b border-green-200">
        <Text className="text-base font-semibold mb-1 text-gray-900">
          {tr.outcome.resolvedHeader}
        </Text>
        <Text className="text-lg text-gray-900">{label}</Text>
      </View>
    );
  }

  if (alreadyReported) {
    return (
      <View className="p-4 bg-gray-50 border-b border-gray-200">
        <Text className="text-sm text-gray-700">
          {tr.outcome.alreadyReported}
        </Text>
      </View>
    );
  }

  return (
    <View className="p-4 bg-amber-50 border-b border-amber-200">
      <Text className="text-base font-semibold mb-1 text-gray-900">
        {tr.outcome.cardTitle}
      </Text>
      <Text className="text-sm text-gray-700 mb-3">
        {tr.outcome.cardDescription}
      </Text>
      <View className="gap-2">
        {OPTIONS.map((o) => {
          const label = tr.outcome[o.labelKey];
          return (
            <Pressable
              key={o.value}
              onPress={() =>
                Alert.alert('', tr.outcome.submitConfirm(label), [
                  { text: tr.common.cancel, style: 'cancel' },
                  {
                    text: tr.outcome.submit,
                    onPress: () => mut.mutate(o.value),
                  },
                ])
              }
              disabled={mut.isPending}
              className="py-3 bg-white border border-amber-400 rounded active:opacity-70">
              <Text className="text-center font-medium text-gray-900">
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
