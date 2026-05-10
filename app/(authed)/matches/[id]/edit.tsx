import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { ApiError } from '../../../../src/api/client';
import {
  cancelMatch,
  getMatch,
  updateMatch,
  type MatchDetail,
  type UpdateMatchPayload,
} from '../../../../src/api/matches';
import { tr } from '../../../../src/i18n/tr';
import { DateTimeField } from '../../../../src/components/DateTimeField';

const FORMAT_OPTIONS = [5, 6, 7, 8, 9, 10, 11] as const;
const DIFFICULTY_OPTIONS = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
type Privacy = 'OPEN' | 'LOCKED' | 'INVITE_ONLY';

const BLOCKED_STATES = ['LIVE', 'RATING_WINDOW', 'CLOSED', 'CANCELLED'];

type FormState = {
  difficulty: Difficulty;
  privacy: Privacy;
  city: string;
  district: string;
  scheduledAt: Date | null;
  durationMin: string;
  pitchName: string;
  pitchAddress: string;
  pitchLat: string;
  pitchLng: string;
  pricePerPerson: string;
};

function matchToForm(m: MatchDetail): FormState {
  return {
    difficulty: (m.difficulty as Difficulty) ?? 'MEDIUM',
    privacy: m.isInviteOnly
      ? 'INVITE_ONLY'
      : m.isLocked
        ? 'LOCKED'
        : 'OPEN',
    city: m.city ?? '',
    district: m.district ?? '',
    scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
    durationMin: m.durationMin ? String(m.durationMin) : '',
    pitchName: m.pitchName ?? '',
    pitchAddress: m.pitchAddress ?? '',
    pitchLat: m.pitchLat != null ? String(m.pitchLat) : '',
    pitchLng: m.pitchLng != null ? String(m.pitchLng) : '',
    pricePerPerson:
      m.pricePerPerson != null ? String(m.pricePerPerson) : '',
  };
}

// Build the diff payload — only include fields the user actually changed,
// so PATCH calls stay minimal and we don't accidentally clobber server-side
// defaults the form didn't render.
function buildDiff(
  form: FormState,
  initial: FormState,
): { payload: UpdateMatchPayload | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const t = tr.matchForm.errors;
  const payload: UpdateMatchPayload = {};

  if (form.difficulty !== initial.difficulty) {
    payload.difficulty = form.difficulty;
  }

  // Privacy diff: only isLocked is editable (UpdateMatchDto excludes
  // isInviteOnly). If the original is INVITE_ONLY we never toggle anything.
  if (initial.privacy !== 'INVITE_ONLY' && form.privacy !== initial.privacy) {
    if (form.privacy === 'OPEN' || form.privacy === 'LOCKED') {
      payload.isLocked = form.privacy === 'LOCKED';
    }
  }

  const city = form.city.trim();
  if (city !== initial.city) {
    if (city.length > 80) errors.city = t.cityTooLong;
    else payload.city = city;
  }
  const district = form.district.trim();
  if (district !== initial.district) {
    if (district.length > 80) errors.district = t.districtTooLong;
    else payload.district = district;
  }

  const formScheduledMs = form.scheduledAt?.getTime() ?? null;
  const initialScheduledMs = initial.scheduledAt?.getTime() ?? null;
  if (formScheduledMs !== initialScheduledMs) {
    if (form.scheduledAt) {
      if (form.scheduledAt.getTime() < Date.now()) {
        errors.scheduledAt = t.scheduledInPast;
      } else {
        payload.scheduledAt = form.scheduledAt.toISOString();
      }
    }
  }

  if (form.durationMin !== initial.durationMin) {
    const dur = form.durationMin.trim();
    if (dur) {
      const n = parseInt(dur, 10);
      if (!Number.isInteger(n) || n < 30 || n > 180) {
        errors.durationMin = t.durationRange;
      } else {
        payload.durationMin = n;
      }
    }
  }

  if (form.pitchName !== initial.pitchName) {
    const v = form.pitchName.trim();
    if (v.length > 200) errors.pitchName = t.pitchNameTooLong;
    else payload.pitchName = v;
  }
  if (form.pitchAddress !== initial.pitchAddress) {
    const v = form.pitchAddress.trim();
    if (v.length > 500) errors.pitchAddress = t.pitchAddressTooLong;
    else payload.pitchAddress = v;
  }

  if (form.pitchLat !== initial.pitchLat) {
    const s = form.pitchLat.trim().replace(',', '.');
    if (s) {
      const n = parseFloat(s);
      if (!Number.isFinite(n) || n < -90 || n > 90)
        errors.pitchLat = t.latRange;
      else payload.pitchLat = n;
    }
  }
  if (form.pitchLng !== initial.pitchLng) {
    const s = form.pitchLng.trim().replace(',', '.');
    if (s) {
      const n = parseFloat(s);
      if (!Number.isFinite(n) || n < -180 || n > 180)
        errors.pitchLng = t.lngRange;
      else payload.pitchLng = n;
    }
  }

  if (form.pricePerPerson !== initial.pricePerPerson) {
    const s = form.pricePerPerson.trim().replace(',', '.');
    if (s) {
      const n = parseFloat(s);
      if (!Number.isFinite(n) || n < 0) errors.pricePerPerson = t.pricePositive;
      else payload.pricePerPerson = Math.round(n * 100) / 100;
    }
  }

  if (Object.keys(errors).length > 0) return { payload: null, errors };
  if (Object.keys(payload).length === 0) return { payload: null, errors };
  return { payload, errors };
}

type ChipProps = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function Chip({ label, selected, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`px-3 py-2 rounded-lg border ${
        disabled
          ? 'bg-gray-100 border-gray-200'
          : selected
            ? 'bg-blue-600 border-blue-600'
            : 'bg-white border-gray-300'
      }`}>
      <Text
        className={`text-sm ${
          disabled
            ? 'text-gray-400'
            : selected
              ? 'text-white font-semibold'
              : 'text-gray-800'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

type RadioRowProps = {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  title: string;
  hint: string;
};

function RadioRow({
  selected,
  disabled,
  onPress,
  title,
  hint,
}: RadioRowProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center gap-3 border rounded-lg p-3 ${
        disabled
          ? 'border-gray-200 bg-gray-100'
          : selected
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 bg-white'
      }`}>
      <View
        className={`w-5 h-5 rounded-full border ${
          selected ? 'border-blue-600' : 'border-gray-400'
        } items-center justify-center`}>
        {selected ? (
          <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />
        ) : null}
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-semibold ${
            disabled ? 'text-gray-500' : 'text-gray-900'
          }`}>
          {title}
        </Text>
        <Text className="text-xs text-gray-600">{hint}</Text>
      </View>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  maxLength?: number;
};

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  keyboardType = 'default',
  maxLength,
}: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className={`border rounded-lg p-3 text-base ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      />
      {error ? <Text className="text-xs text-red-700">{error}</Text> : null}
    </View>
  );
}

export default function EditMatchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const matchQuery = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (matchQuery.data && !form) {
      const f = matchToForm(matchQuery.data);
      setForm(f);
      setInitial(f);
    }
  }, [matchQuery.data, form]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMatchPayload) => updateMatch(matchId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.back();
    },
    onError: (err) => surfaceApiError(err, tr.matchForm.errors.submitFailed),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelMatch(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.back();
    },
    onError: (err) => surfaceApiError(err, tr.matchForm.errors.submitFailed),
  });

  const setField =
    <K extends keyof FormState>(key: K) =>
    (v: FormState[K]) =>
      setForm((prev) => (prev ? { ...prev, [key]: v } : prev));

  const onSubmit = () => {
    if (!form || !initial) return;
    const { payload, errors: nextErrors } = buildDiff(form, initial);
    setErrors(nextErrors);
    if (!payload) {
      // No diff or only validation errors — nothing to send.
      if (Object.keys(nextErrors).length === 0) {
        router.back();
      }
      return;
    }
    updateMutation.mutate(payload);
  };

  const onCancelMatch = () => {
    Alert.alert(tr.matchForm.cancelMatch, tr.matchForm.cancelConfirm, [
      { text: tr.matchForm.cancelNo, style: 'cancel' },
      {
        text: tr.matchForm.cancelYes,
        style: 'destructive',
        onPress: () => cancelMutation.mutate(),
      },
    ]);
  };

  const minDate = useMemo(() => new Date(), []);

  if (!matchId || matchQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 p-4 gap-3">
        <BackHeader onBack={() => router.back()} title={tr.matchForm.editTitle} />
        <View className="border-2 border-red-500 bg-red-100 rounded-lg p-3">
          <Text className="text-sm text-red-900">
            {tr.matchDetail.loadFailed}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const match = matchQuery.data;
  const blocked = BLOCKED_STATES.includes(match.state);

  if (blocked) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 p-4 gap-3">
        <BackHeader onBack={() => router.back()} title={tr.matchForm.editTitle} />
        <View className="border border-yellow-400 bg-yellow-50 rounded-lg p-3">
          <Text className="text-sm text-yellow-900">
            {tr.matchForm.blockedStateHint}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!form || !initial) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const inviteOnlyLocked = initial.privacy === 'INVITE_ONLY';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerClassName="p-4 gap-4">
        <BackHeader
          onBack={() => router.back()}
          title={tr.matchForm.editTitle}
        />

        <View className="gap-1">
          <Text className="text-sm font-semibold text-gray-700">
            {tr.matchForm.fields.format}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {FORMAT_OPTIONS.map((f) => (
              <Chip
                key={f}
                label={tr.matches.formatLabel(f)}
                selected={match.format === f}
                disabled
                onPress={() => {}}
              />
            ))}
          </View>
          <Text className="text-xs text-gray-500">
            {tr.matchForm.immutableHint}
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-gray-700">
            {tr.matchForm.fields.difficulty}
          </Text>
          <View className="flex-row gap-2">
            {DIFFICULTY_OPTIONS.map((d) => (
              <Chip
                key={d}
                label={
                  d === 'EASY'
                    ? tr.matchForm.difficultyOptions.easy
                    : d === 'MEDIUM'
                      ? tr.matchForm.difficultyOptions.medium
                      : tr.matchForm.difficultyOptions.hard
                }
                selected={form.difficulty === d}
                onPress={() => setField('difficulty')(d)}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-gray-700">
            {tr.matchForm.fields.privacy}
          </Text>
          <RadioRow
            selected={form.privacy === 'OPEN'}
            disabled={inviteOnlyLocked}
            onPress={() => setField('privacy')('OPEN')}
            title={tr.matchForm.fields.privacyOpen}
            hint={tr.matchForm.fields.privacyOpenHint}
          />
          <RadioRow
            selected={form.privacy === 'LOCKED'}
            disabled={inviteOnlyLocked}
            onPress={() => setField('privacy')('LOCKED')}
            title={tr.matchForm.fields.privacyLocked}
            hint={tr.matchForm.fields.privacyLockedHint}
          />
          <RadioRow
            selected={form.privacy === 'INVITE_ONLY'}
            disabled
            onPress={() => {}}
            title={tr.matchForm.fields.privacyInviteOnly}
            hint={tr.matchForm.fields.privacyInviteOnlyHint}
          />
          {inviteOnlyLocked ? (
            <Text className="text-xs text-gray-500">
              {tr.matchForm.immutableHint}
            </Text>
          ) : null}
        </View>

        <Field
          label={tr.matchForm.fields.city}
          value={form.city}
          onChange={setField('city')}
          error={errors.city}
          placeholder={tr.matchForm.fields.cityPlaceholder}
          maxLength={80}
        />
        <Field
          label={tr.matchForm.fields.district}
          value={form.district}
          onChange={setField('district')}
          error={errors.district}
          placeholder={tr.matchForm.fields.districtPlaceholder}
          maxLength={80}
        />

        <DateTimeField
          label={tr.matchForm.fields.scheduledAt}
          value={form.scheduledAt}
          onChange={setField('scheduledAt')}
          mode="datetime"
          minimumDate={minDate}
          errorMessage={errors.scheduledAt}
        />

        <Field
          label={tr.matchForm.fields.durationMin}
          value={form.durationMin}
          onChange={setField('durationMin')}
          error={errors.durationMin}
          placeholder={tr.matchForm.fields.durationMinPlaceholder}
          keyboardType="numeric"
          maxLength={3}
        />

        <Field
          label={tr.matchForm.fields.pitchName}
          value={form.pitchName}
          onChange={setField('pitchName')}
          error={errors.pitchName}
          placeholder={tr.matchForm.fields.pitchNamePlaceholder}
          maxLength={200}
        />
        <Field
          label={tr.matchForm.fields.pitchAddress}
          value={form.pitchAddress}
          onChange={setField('pitchAddress')}
          error={errors.pitchAddress}
          placeholder={tr.matchForm.fields.pitchAddressPlaceholder}
          maxLength={500}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label={tr.matchForm.fields.pitchLat}
              value={form.pitchLat}
              onChange={setField('pitchLat')}
              error={errors.pitchLat}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Field
              label={tr.matchForm.fields.pitchLng}
              value={form.pitchLng}
              onChange={setField('pitchLng')}
              error={errors.pitchLng}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Field
          label={tr.matchForm.fields.pricePerPerson}
          value={form.pricePerPerson}
          onChange={setField('pricePerPerson')}
          error={errors.pricePerPerson}
          placeholder={tr.matchForm.fields.pricePerPersonPlaceholder}
          keyboardType="decimal-pad"
        />

        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={() => router.back()}
            disabled={updateMutation.isPending || cancelMutation.isPending}
            className="flex-1 border border-gray-400 rounded-lg p-4 active:opacity-80">
            <Text className="text-center font-semibold">
              {tr.matchForm.cancel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={updateMutation.isPending || cancelMutation.isPending}
            className="flex-1 bg-blue-600 rounded-lg p-4 active:opacity-80">
            <Text className="text-center font-semibold text-white">
              {updateMutation.isPending
                ? tr.matchForm.submitting
                : tr.matchForm.submit}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onCancelMatch}
          disabled={updateMutation.isPending || cancelMutation.isPending}
          className="bg-red-600 rounded-lg p-4 mt-3 mb-4 active:opacity-80">
          <Text className="text-center font-semibold text-white">
            {cancelMutation.isPending
              ? tr.matchForm.submitting
              : tr.matchForm.cancelMatch}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Pressable onPress={onBack} className="active:opacity-60">
        <Ionicons name="chevron-back" size={24} color="#2563eb" />
      </Pressable>
      <Text className="text-2xl font-bold">{title}</Text>
    </View>
  );
}

function surfaceApiError(err: unknown, fallback: string) {
  const apiErr = err instanceof ApiError ? err : null;
  const backendMessage =
    apiErr &&
    typeof apiErr.body === 'object' &&
    apiErr.body !== null &&
    'message' in apiErr.body
      ? String((apiErr.body as { message: unknown }).message)
      : null;
  Alert.alert(fallback, backendMessage ?? tr.common.error);
}
