import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {
  forceLock,
  listPublicly,
  sendManualReminder,
  setFormatOverride,
  setTeamModeOverride,
  skipInstance,
  unlistPublicly,
} from '../api/series-instances';
import { tr } from '../i18n/tr';

type Props = {
  matchId: string;
  confirms: number;
  isPubliclyListed: boolean;
  // Series-level field; null means "use the system-derived format".
  currentOverride: number | null;
  // S1D: parent series' default team mode + this instance's override. Picker
  // only renders when seriesTeamMode === 'FIXED' (the only direction where
  // override is legal — MIXED→FIXED is blocked by the backend).
  seriesTeamMode: 'MIXED' | 'FIXED' | null;
  currentTeamModeOverride: 'MIXED' | 'FIXED' | null;
  visible: boolean;
  onClose: () => void;
};

export function SeriesAuthoritySheet({
  matchId,
  confirms,
  isPubliclyListed,
  currentOverride,
  seriesTeamMode,
  currentTeamModeOverride,
  visible,
  onClose,
}: Props) {
  const qc = useQueryClient();
  // Backend rule: floor(coming/2), max 11. Override only allowed downward —
  // pick any 5..maxFormat where maxFormat is the system's natural choice.
  const deterministicMax = Math.min(11, Math.floor(confirms / 2));
  const validOverrides: number[] = [];
  for (let f = 5; f <= deterministicMax; f += 1) validOverrides.push(f);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['match', matchId] });

  const mutSkip = useMutation({
    mutationFn: () => skipInstance(matchId),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutForceLock = useMutation({
    mutationFn: () => forceLock(matchId),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutReminder = useMutation({
    mutationFn: () => sendManualReminder(matchId),
    onSuccess: () => Alert.alert(tr.seriesAuthority.reminderSent),
    onError: (e: Error) =>
      Alert.alert(e.message || tr.seriesAuthority.reminderRateLimited),
  });
  const mutOverride = useMutation({
    mutationFn: (f: number | null) => setFormatOverride(matchId, f),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutList = useMutation({
    mutationFn: () =>
      isPubliclyListed ? unlistPublicly(matchId) : listPublicly(matchId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });
  const mutTeamMode = useMutation({
    mutationFn: (mode: 'MIXED' | 'FIXED' | null) =>
      setTeamModeOverride(matchId, mode),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          className="mt-auto bg-white rounded-t-2xl"
          onPress={(e) => e.stopPropagation()}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold">
                {tr.seriesAuthority.sheetTitle}
              </Text>
              <Pressable onPress={onClose} className="active:opacity-60">
                <Text className="text-blue-600 text-sm">
                  {tr.seriesAuthority.close}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                Alert.alert(
                  tr.seriesAuthority.skipThisWeek,
                  tr.seriesAuthority.skipConfirm,
                  [
                    { text: tr.common.cancel, style: 'cancel' },
                    {
                      text: tr.seriesAuthority.skipThisWeek,
                      style: 'destructive',
                      onPress: () => mutSkip.mutate(),
                    },
                  ],
                )
              }
              className="py-3 active:opacity-60">
              <Text className="text-red-600 font-medium">
                {tr.seriesAuthority.skipThisWeek}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  tr.seriesAuthority.forceLock,
                  tr.seriesAuthority.forceLockConfirm,
                  [
                    { text: tr.common.cancel, style: 'cancel' },
                    {
                      text: tr.seriesAuthority.forceLock,
                      onPress: () => mutForceLock.mutate(),
                    },
                  ],
                )
              }
              className="py-3 active:opacity-60">
              <Text className="text-blue-700 font-medium">
                {tr.seriesAuthority.forceLock}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => mutReminder.mutate()}
              disabled={mutReminder.isPending}
              className="py-3 active:opacity-60">
              <Text className="text-gray-900">
                {tr.seriesAuthority.sendReminder}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => mutList.mutate()}
              disabled={mutList.isPending}
              className="py-3 active:opacity-60">
              <Text className="text-gray-900">
                {isPubliclyListed
                  ? tr.seriesAuthority.unlistPublicly
                  : tr.seriesAuthority.listPublicly}
              </Text>
            </Pressable>

            <View className="py-3">
              <Text className="text-sm font-medium mb-1">
                {tr.seriesAuthority.formatOverrideLabel}
              </Text>
              <Text className="text-xs text-gray-500 mb-2">
                {tr.seriesAuthority.formatOverrideHint}
              </Text>
              {deterministicMax < 5 ? (
                <Text className="text-xs italic text-gray-500">
                  {tr.seriesAuthority.formatOverrideNotAvailable}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => mutOverride.mutate(null)}
                    className={`px-3 py-1.5 rounded ${currentOverride === null ? 'bg-blue-600' : 'bg-gray-100'} active:opacity-80`}>
                    <Text
                      className={
                        currentOverride === null
                          ? 'text-white'
                          : 'text-gray-700'
                      }>
                      {tr.seriesAuthority.formatOverrideClear}
                    </Text>
                  </Pressable>
                  {validOverrides.map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => mutOverride.mutate(f)}
                      className={`px-3 py-1.5 rounded ${currentOverride === f ? 'bg-blue-600' : 'bg-gray-100'} active:opacity-80`}>
                      <Text
                        className={
                          currentOverride === f
                            ? 'text-white'
                            : 'text-gray-700'
                        }>
                        {f}v{f}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {seriesTeamMode === 'FIXED' ? (
              <View className="py-3">
                <Text className="text-sm font-medium mb-1">
                  {tr.seriesAuthority.teamModeOverrideLabel}
                </Text>
                <Text className="text-xs text-gray-500 mb-2">
                  {tr.seriesAuthority.teamModeOverrideHint}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => mutTeamMode.mutate(null)}
                    disabled={mutTeamMode.isPending}
                    className={`px-3 py-1.5 rounded ${currentTeamModeOverride === null ? 'bg-blue-600' : 'bg-gray-100'} active:opacity-80`}>
                    <Text
                      className={
                        currentTeamModeOverride === null
                          ? 'text-white'
                          : 'text-gray-700'
                      }>
                      {tr.seriesAuthority.teamModeOverrideKeepFixed}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => mutTeamMode.mutate('MIXED')}
                    disabled={mutTeamMode.isPending}
                    className={`px-3 py-1.5 rounded ${currentTeamModeOverride === 'MIXED' ? 'bg-blue-600' : 'bg-gray-100'} active:opacity-80`}>
                    <Text
                      className={
                        currentTeamModeOverride === 'MIXED'
                          ? 'text-white'
                          : 'text-gray-700'
                      }>
                      {tr.seriesAuthority.teamModeOverrideShuffle}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
