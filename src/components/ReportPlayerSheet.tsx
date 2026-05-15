import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { ApiError } from '../api/client';
import {
  REPORT_REASONS,
  reportPlayer,
  type ReportReason,
} from '../api/moderation';
import { tr } from '../i18n/tr';

type Props = {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedDisplayName?: string;
};

export function ReportPlayerSheet({
  visible,
  onClose,
  reportedUserId,
  reportedDisplayName,
}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // New sheet-open = new genuine attempt. Retries while the sheet remains
  // open reuse the same key so flaky-network repeats hit backend replay,
  // while close + reopen gets a fresh key so the duplicate-report guard can
  // return its intended 409 instead of replaying an old 201.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setNotes('');
      setSubmitting(false);
      setIdempotencyKey(Crypto.randomUUID());
      return;
    }
    setReason(null);
    setNotes('');
    setSubmitting(false);
    setIdempotencyKey('');
  }, [visible]);

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting || !idempotencyKey) return;
    setSubmitting(true);
    try {
      await reportPlayer(
        {
          reportedUserId,
          reason,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        { idempotencyKey },
      );
      Alert.alert(tr.report.success);
      onClose();
    } catch (err) {
      const isIdempotencyConflict =
        err instanceof ApiError &&
        err.status === 409 &&
        err.message.includes('Idempotency-Key');
      if (err instanceof ApiError && err.status === 409 && !isIdempotencyConflict) {
        Alert.alert(tr.report.alreadyReported);
        onClose();
        return;
      }
      const message = err instanceof ApiError ? err.message : tr.report.submitFailed;
      Alert.alert(tr.report.submitFailed, message);
      setSubmitting(false);
    }
  };

  const title = reportedDisplayName
    ? `${reportedDisplayName} · ${tr.report.modalTitle}`
    : tr.report.modalTitle;
  const canSubmit = !!reason && !submitting && !!idempotencyKey;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="rounded-t-3xl bg-white p-5 gap-4">
            <Text className="text-xl font-bold">{title}</Text>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-gray-700">
                {tr.report.reasonLabel}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {REPORT_REASONS.map((item) => {
                  const selected = reason === item;
                  return (
                    <Pressable
                      key={item}
                      disabled={submitting}
                      onPress={() => setReason(item)}
                      className={`rounded-full border px-3 py-2 ${
                        selected
                          ? 'border-red-600 bg-red-600'
                          : 'border-gray-300 bg-white'
                      } ${submitting ? 'opacity-60' : 'active:opacity-70'}`}>
                      <Text
                        className={`text-sm ${
                          selected ? 'text-white' : 'text-gray-700'
                        }`}>
                        {tr.report.reasons[item]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-gray-700">
                {tr.report.notesLabel}
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={tr.report.notesPlaceholder}
                maxLength={500}
                multiline
                editable={!submitting}
                className="border border-gray-300 rounded-lg p-3 text-base bg-white"
                style={{ minHeight: 84, textAlignVertical: 'top' }}
              />
            </View>

            <View className="flex-row gap-3 pt-1">
              <Pressable
                className="flex-1 border border-gray-400 rounded-lg p-4 active:opacity-80"
                onPress={handleClose}
                disabled={submitting}>
                <Text className="text-center font-semibold">
                  {tr.report.cancel}
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-lg p-4 ${
                  canSubmit ? 'bg-red-600 active:opacity-80' : 'bg-gray-300'
                }`}
                onPress={handleSubmit}
                disabled={!canSubmit}>
                <Text className="text-white text-center font-semibold">
                  {submitting ? tr.report.submitting : tr.report.submit}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
