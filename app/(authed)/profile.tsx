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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMe,
  updateMyProfile,
  type MeResponse,
  type Position,
  type UpdateProfilePayload,
  POSITIONS,
} from '../../src/api/me';
import { getRatingsForUser, type UserRatings } from '../../src/api/ratings';
import { ApiError } from '../../src/api/client';
import { tr } from '../../src/i18n/tr';
import { DateTimeField } from '../../src/components/DateTimeField';
import { RatingsCard } from '../../src/components/RatingsCard';

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;

type FormState = {
  username: string;
  firstName: string;
  lastName: string;
  city: string;
  district: string;
  dob: Date | null;
  height: string;
  weight: string;
  position1: string;
  position2: string;
  position3: string;
};

const EMPTY_FORM: FormState = {
  username: '',
  firstName: '',
  lastName: '',
  city: '',
  district: '',
  dob: null,
  height: '',
  weight: '',
  position1: '',
  position2: '',
  position3: '',
};

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function meToForm(me: MeResponse): FormState {
  const p = me.profile;
  if (!p) return EMPTY_FORM;
  return {
    username: p.username ?? '',
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    city: p.city ?? '',
    district: p.district ?? '',
    dob: isoToDate(p.dateOfBirth),
    height: p.height != null ? String(p.height) : '',
    weight: p.weight != null ? String(p.weight) : '',
    position1: p.position1 ?? '',
    position2: p.position2 ?? '',
    position3: p.position3 ?? '',
  };
}

function isValidPosition(v: string): v is Position {
  return (POSITIONS as readonly string[]).includes(v);
}

// Convert a local-clock Date (from picker) to a UTC ISO string anchored at
// midnight. Profile DOB is a date-of-birth — time-of-day is meaningless, but
// the backend stores ISO strings. UTC keeps the day stable across timezones.
function dobToIso(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  ).toISOString();
}

function buildPayload(
  form: FormState,
  initial: FormState,
): { payload: UpdateProfilePayload; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const payload: UpdateProfilePayload = {};

  const u = form.username.trim();
  if (u !== initial.username) {
    if (u.length > 30) errors.username = tr.profile.validation.usernameLength;
    else if (u && !USERNAME_RE.test(u))
      errors.username = tr.profile.validation.usernameFormat;
    if (u) payload.username = u;
  }

  const fn = form.firstName.trim();
  if (fn !== initial.firstName) {
    if (fn.length > 50) errors.firstName = tr.profile.validation.nameLength;
    payload.firstName = fn;
  }

  const ln = form.lastName.trim();
  if (ln !== initial.lastName) {
    if (ln.length > 50) errors.lastName = tr.profile.validation.nameLength;
    payload.lastName = ln;
  }

  const city = form.city.trim();
  if (city !== initial.city) {
    if (city.length > 50) errors.city = tr.profile.validation.cityLength;
    payload.city = city;
  }

  const district = form.district.trim();
  if (district !== initial.district) {
    if (district.length > 50) errors.district = tr.profile.validation.districtLength;
    payload.district = district;
  }

  const dobChanged =
    (form.dob?.getTime() ?? null) !== (initial.dob?.getTime() ?? null);
  if (dobChanged && form.dob) {
    payload.dateOfBirth = dobToIso(form.dob);
  }

  const h = form.height.trim();
  if (h !== initial.height) {
    if (h) {
      const n = parseInt(h, 10);
      if (!Number.isInteger(n) || n < 100 || n > 250)
        errors.height = tr.profile.validation.heightRange;
      else payload.height = n;
    }
  }

  const w = form.weight.trim();
  if (w !== initial.weight) {
    if (w) {
      const n = parseInt(w, 10);
      if (!Number.isInteger(n) || n < 30 || n > 200)
        errors.weight = tr.profile.validation.weightRange;
      else payload.weight = n;
    }
  }

  for (const key of ['position1', 'position2', 'position3'] as const) {
    const val = form[key].trim().toUpperCase();
    if (val !== initial[key]) {
      if (val) {
        if (!isValidPosition(val))
          errors[key] = tr.profile.validation.positionInvalid;
        else payload[key] = val;
      }
    }
  }

  return { payload, errors };
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
  maxLength?: number;
  editable?: boolean;
};

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  editable = true,
}: FieldProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-gray-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        className={`border rounded-lg p-3 text-base ${
          error
            ? 'border-red-500 bg-red-50'
            : editable
              ? 'border-gray-300 bg-white'
              : 'border-gray-200 bg-gray-100 text-gray-700'
        }`}
      />
      {error ? <Text className="text-xs text-red-700">{error}</Text> : null}
    </View>
  );
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { data, error, isLoading, refetch } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: getMe,
  });
  const ratingsQuery = useQuery<UserRatings>({
    queryKey: ['user-ratings', data?.id ?? null],
    queryFn: () => getRatingsForUser(data!.id),
    enabled: !!data?.id,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initial, setInitial] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (data) {
      const f = meToForm(data);
      setForm(f);
      setInitial(f);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateMyProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setErrors({});
      setEditing(false);
      Alert.alert(tr.profile.saveSuccess);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : tr.profile.saveFailed;
      Alert.alert(tr.profile.saveFailed, msg);
    },
  });

  const setField = (key: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const onSave = () => {
    const { payload, errors: nextErrors } = buildPayload(form, initial);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    mutation.mutate(payload);
  };

  const onCancel = () => {
    setForm(initial);
    setErrors({});
    setEditing(false);
  };

  const usernameChangesLeft = data?.profile?.usernameChangesLeft ?? 0;
  const onboardingDone = data?.profile?.onboardingDone ?? false;

  const positionsHint = useMemo(() => tr.profile.positionsHint, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView className="flex-1 bg-white p-6 gap-3">
        <Text className="text-lg font-semibold">{tr.profile.loadFailed}</Text>
        <Text className="text-sm text-gray-600">
          {error instanceof Error ? error.message : tr.common.error}
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg p-4 active:opacity-80"
          onPress={() => refetch()}>
          <Text className="text-white text-center font-semibold">
            {tr.common.retry}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-6 gap-4">
        <Text className="text-3xl font-bold">{tr.profile.title}</Text>

        {!onboardingDone ? (
          <View className="border-2 border-yellow-500 bg-yellow-50 rounded-lg p-3">
            <Text className="text-sm font-medium">
              {tr.profile.onboardingHint}
            </Text>
          </View>
        ) : null}

        <View className="bg-gray-50 rounded-lg p-3 gap-1">
          <Text className="text-xs text-gray-500">
            {tr.profile.fields.phone}: {data.phone ?? '—'}
          </Text>
          <Text className="text-xs text-gray-500">
            {tr.profile.fields.email}: {data.email ?? '—'}
          </Text>
        </View>

        <Field
          label={tr.profile.fields.username}
          value={form.username}
          onChange={setField('username')}
          error={errors.username}
          autoCapitalize="none"
          maxLength={30}
          editable={editing}
        />
        <Text className="text-xs text-gray-500 -mt-2">
          {tr.profile.usernameChangesLeft(usernameChangesLeft)}
        </Text>

        <Field
          label={tr.profile.fields.firstName}
          value={form.firstName}
          onChange={setField('firstName')}
          error={errors.firstName}
          maxLength={50}
          editable={editing}
        />
        <Field
          label={tr.profile.fields.lastName}
          value={form.lastName}
          onChange={setField('lastName')}
          error={errors.lastName}
          maxLength={50}
          editable={editing}
        />
        <Field
          label={tr.profile.fields.city}
          value={form.city}
          onChange={setField('city')}
          error={errors.city}
          maxLength={50}
          editable={editing}
        />
        <Field
          label={tr.profile.fields.district}
          value={form.district}
          onChange={setField('district')}
          error={errors.district}
          maxLength={50}
          editable={editing}
        />

        <DateTimeField
          label={tr.profile.fields.dateOfBirth}
          value={form.dob}
          onChange={(v) => setForm((prev) => ({ ...prev, dob: v }))}
          mode="date"
          maximumDate={new Date()}
          disabled={!editing}
          errorMessage={errors.dateOfBirth}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field
              label={tr.profile.fields.height}
              value={form.height}
              onChange={setField('height')}
              error={errors.height}
              keyboardType="numeric"
              maxLength={3}
              editable={editing}
            />
          </View>
          <View className="flex-1">
            <Field
              label={tr.profile.fields.weight}
              value={form.weight}
              onChange={setField('weight')}
              error={errors.weight}
              keyboardType="numeric"
              maxLength={3}
              editable={editing}
            />
          </View>
        </View>

        <Field
          label={tr.profile.fields.position1}
          value={form.position1}
          onChange={setField('position1')}
          error={errors.position1}
          autoCapitalize="characters"
          maxLength={4}
          editable={editing}
        />
        <Field
          label={tr.profile.fields.position2}
          value={form.position2}
          onChange={setField('position2')}
          error={errors.position2}
          autoCapitalize="characters"
          maxLength={4}
          editable={editing}
        />
        <Field
          label={tr.profile.fields.position3}
          value={form.position3}
          onChange={setField('position3')}
          error={errors.position3}
          autoCapitalize="characters"
          maxLength={4}
          editable={editing}
        />
        <Text className="text-xs text-gray-500">{positionsHint}</Text>

        {!ratingsQuery.error ? (
          <View className="mt-2">
            <RatingsCard
              ratings={ratingsQuery.data}
              isLoading={ratingsQuery.isLoading}
              error={null}
            />
          </View>
        ) : null}

        {editing ? (
          <View className="flex-row gap-3 mt-2">
            <Pressable
              className="flex-1 border border-gray-400 rounded-lg p-4 active:opacity-80"
              onPress={onCancel}
              disabled={mutation.isPending}>
              <Text className="text-center font-semibold">
                {tr.common.cancel}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 bg-blue-600 rounded-lg p-4 active:opacity-80"
              onPress={onSave}
              disabled={mutation.isPending}>
              <Text className="text-white text-center font-semibold">
                {mutation.isPending ? tr.common.saving : tr.common.save}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            className="bg-blue-600 rounded-lg p-4 active:opacity-80 mt-2"
            onPress={() => setEditing(true)}>
            <Text className="text-white text-center font-semibold">
              {tr.profile.edit}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
