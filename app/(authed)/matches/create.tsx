import { useEffect, useMemo, useState } from 'react';
import {
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
import { useRouter, type Href } from 'expo-router';
import { ApiError } from '../../../src/api/client';
import {
  createMatch,
  type CreateMatchPayload,
  type MatchDetail,
} from '../../../src/api/matches';
import { getMe, type MeResponse } from '../../../src/api/me';
import { tr } from '../../../src/i18n/tr';
import { DateTimeField } from '../../../src/components/DateTimeField';

const FORMAT_OPTIONS = [5, 6, 7, 8, 9, 10, 11] as const;
const DIFFICULTY_OPTIONS = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
type Privacy = 'OPEN' | 'LOCKED' | 'INVITE_ONLY';

type FormState = {
  format: number;
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

const EMPTY_FORM: FormState = {
  format: 5,
  difficulty: 'MEDIUM',
  privacy: 'OPEN',
  city: '',
  district: '',
  scheduledAt: null,
  durationMin: '60',
  pitchName: '',
  pitchAddress: '',
  pitchLat: '',
  pitchLng: '',
  pricePerPerson: '',
};

function buildPayload(form: FormState): {
  payload: CreateMatchPayload | null;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const t = tr.matchForm.errors;

  const city = form.city.trim();
  if (city.length > 80) errors.city = t.cityTooLong;

  const district = form.district.trim();
  if (district.length > 80) errors.district = t.districtTooLong;

  const pitchName = form.pitchName.trim();
  if (pitchName.length > 200) errors.pitchName = t.pitchNameTooLong;

  const pitchAddress = form.pitchAddress.trim();
  if (pitchAddress.length > 500)
    errors.pitchAddress = t.pitchAddressTooLong;

  let durationMin: number | undefined;
  const dur = form.durationMin.trim();
  if (dur) {
    const n = parseInt(dur, 10);
    if (!Number.isInteger(n) || n < 30 || n > 180) {
      errors.durationMin = t.durationRange;
    } else {
      durationMin = n;
    }
  }

  let pricePerPerson: number | undefined;
  const price = form.pricePerPerson.trim().replace(',', '.');
  if (price) {
    const n = parseFloat(price);
    if (!Number.isFinite(n) || n < 0) {
      errors.pricePerPerson = t.pricePositive;
    } else {
      pricePerPerson = Math.round(n * 100) / 100;
    }
  }

  let pitchLat: number | undefined;
  const latStr = form.pitchLat.trim().replace(',', '.');
  if (latStr) {
    const n = parseFloat(latStr);
    if (!Number.isFinite(n) || n < -90 || n > 90) {
      errors.pitchLat = t.latRange;
    } else {
      pitchLat = n;
    }
  }

  let pitchLng: number | undefined;
  const lngStr = form.pitchLng.trim().replace(',', '.');
  if (lngStr) {
    const n = parseFloat(lngStr);
    if (!Number.isFinite(n) || n < -180 || n > 180) {
      errors.pitchLng = t.lngRange;
    } else {
      pitchLng = n;
    }
  }

  if (form.scheduledAt && form.scheduledAt.getTime() < Date.now()) {
    errors.scheduledAt = t.scheduledInPast;
  }

  if (Object.keys(errors).length > 0) return { payload: null, errors };

  const payload: CreateMatchPayload = {
    format: form.format,
    difficulty: form.difficulty,
    isLocked: form.privacy === 'LOCKED',
    isInviteOnly: form.privacy === 'INVITE_ONLY',
  };
  if (city) payload.city = city;
  if (district) payload.district = district;
  if (form.scheduledAt) payload.scheduledAt = form.scheduledAt.toISOString();
  if (durationMin !== undefined) payload.durationMin = durationMin;
  if (pitchName) payload.pitchName = pitchName;
  if (pitchAddress) payload.pitchAddress = pitchAddress;
  if (pitchLat !== undefined) payload.pitchLat = pitchLat;
  if (pitchLng !== undefined) payload.pitchLng = pitchLng;
  if (pricePerPerson !== undefined) payload.pricePerPerson = pricePerPerson;
  return { payload, errors };
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-2 rounded-lg border ${
        selected
          ? 'bg-blue-600 border-blue-600'
          : 'bg-white border-gray-300'
      }`}>
      <Text
        className={`text-sm ${
          selected ? 'text-white font-semibold' : 'text-gray-800'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

type RadioRowProps = {
  selected: boolean;
  onPress: () => void;
  title: string;
  hint: string;
};

function RadioRow({ selected, onPress, title, hint }: RadioRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border rounded-lg p-3 ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'
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
        <Text className="text-sm font-semibold text-gray-900">{title}</Text>
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

export default function CreateMatchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState(false);

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });

  // Prefill city/district from profile once on first load — only if the form
  // is still empty so a user who's typed in something doesn't get clobbered.
  useEffect(() => {
    if (prefilled || !meQuery.data?.profile) return;
    const p = meQuery.data.profile;
    setForm((prev) =>
      prev.city || prev.district
        ? prev
        : {
            ...prev,
            city: p.city ?? '',
            district: p.district ?? '',
          },
    );
    setPrefilled(true);
  }, [meQuery.data, prefilled]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateMatchPayload) => createMatch(payload),
    onSuccess: (created: MatchDetail) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.replace(`/matches/${created.id}` as Href);
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
        tr.matchForm.errors.submitFailed,
        backendMessage ?? tr.common.error,
      );
    },
  });

  const setField =
    <K extends keyof FormState>(key: K) =>
    (v: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: v }));

  const onSubmit = () => {
    const { payload, errors: nextErrors } = buildPayload(form);
    setErrors(nextErrors);
    if (!payload) return;
    createMutation.mutate(payload);
  };

  const minDate = useMemo(() => new Date(), []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerClassName="p-4 gap-4">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            className="active:opacity-60">
            <Ionicons name="chevron-back" size={24} color="#2563eb" />
          </Pressable>
          <Text className="text-2xl font-bold">
            {tr.matchForm.createTitle}
          </Text>
        </View>

        <View className="gap-1">
          <Text className="text-sm font-semibold text-gray-700">
            {tr.matchForm.fields.format}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {FORMAT_OPTIONS.map((f) => (
              <Chip
                key={f}
                label={tr.matches.formatLabel(f)}
                selected={form.format === f}
                onPress={() => setField('format')(f)}
              />
            ))}
          </View>
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
            onPress={() => setField('privacy')('OPEN')}
            title={tr.matchForm.fields.privacyOpen}
            hint={tr.matchForm.fields.privacyOpenHint}
          />
          <RadioRow
            selected={form.privacy === 'LOCKED'}
            onPress={() => setField('privacy')('LOCKED')}
            title={tr.matchForm.fields.privacyLocked}
            hint={tr.matchForm.fields.privacyLockedHint}
          />
          <RadioRow
            selected={form.privacy === 'INVITE_ONLY'}
            onPress={() => setField('privacy')('INVITE_ONLY')}
            title={tr.matchForm.fields.privacyInviteOnly}
            hint={tr.matchForm.fields.privacyInviteOnlyHint}
          />
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

        <View className="flex-row gap-3 mt-2 mb-4">
          <Pressable
            onPress={() => router.back()}
            disabled={createMutation.isPending}
            className="flex-1 border border-gray-400 rounded-lg p-4 active:opacity-80">
            <Text className="text-center font-semibold">
              {tr.matchForm.cancel}
            </Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={createMutation.isPending}
            className="flex-1 bg-blue-600 rounded-lg p-4 active:opacity-80">
            <Text className="text-center font-semibold text-white">
              {createMutation.isPending
                ? tr.matchForm.submitting
                : tr.matchForm.submit}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
