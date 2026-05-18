import { useMutation } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createSeries,
  type CreateSeriesPayload,
} from '../../../src/api/series';
import { tr } from '../../../src/i18n/tr';

// Mirrors the spec's "6 team-color palette for v1" — Tailwind named colors
// rendered as hex so the picker can apply the value directly.
const COLOR_PALETTE = [
  '#E11D48',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#0EA5E9',
];

export default function SeriesCreateScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState('21:00');
  const [durationMin, setDurationMin] = useState('60');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [teamMode, setTeamMode] = useState<'MIXED' | 'FIXED'>('MIXED');
  const [teamAName, setTeamAName] = useState('Kırmızı');
  const [teamAColor, setTeamAColor] = useState(COLOR_PALETTE[0]);
  const [teamBName, setTeamBName] = useState('Mavi');
  const [teamBColor, setTeamBColor] = useState(COLOR_PALETTE[1]);

  const mut = useMutation({
    mutationFn: () => {
      const payload: CreateSeriesPayload = {
        title: title.trim(),
        dayOfWeek,
        timeOfDay,
        durationMin: Number(durationMin) || 60,
        teamMode,
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(district.trim() ? { district: district.trim() } : {}),
        ...(teamMode === 'FIXED'
          ? {
              teams: [
                { name: teamAName.trim(), colorHex: teamAColor },
                { name: teamBName.trim(), colorHex: teamBColor },
              ],
            }
          : {}),
      };
      return createSeries(payload);
    },
    onSuccess: (data) => {
      router.replace(`/series/${data.id}` as Href);
    },
    onError: (e: Error) =>
      Alert.alert(tr.series.createFailed, e.message),
  });

  const submitDisabled = mut.isPending || !title.trim();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-sm font-medium mb-1">
          {tr.series.createTitle}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={tr.series.createTitlePlaceholder}
          className="border border-gray-200 rounded px-3 py-2 mb-3"
        />

        <Text className="text-sm font-medium mb-1">
          {tr.series.createDayLabel}
        </Text>
        <View className="flex-row flex-wrap gap-1 mb-3">
          {tr.series.dayLabels.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setDayOfWeek(i)}
              className={`px-3 py-1.5 rounded-full ${dayOfWeek === i ? 'bg-blue-600' : 'bg-gray-100'}`}>
              <Text
                className={dayOfWeek === i ? 'text-white' : 'text-gray-700'}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-sm font-medium mb-1">
          {tr.series.createTimeLabel}
        </Text>
        <TextInput
          value={timeOfDay}
          onChangeText={setTimeOfDay}
          placeholder="HH:MM"
          keyboardType="numbers-and-punctuation"
          className="border border-gray-200 rounded px-3 py-2 mb-3"
        />

        <Text className="text-sm font-medium mb-1">
          {tr.series.createDurationLabel}
        </Text>
        <TextInput
          value={durationMin}
          onChangeText={setDurationMin}
          keyboardType="number-pad"
          className="border border-gray-200 rounded px-3 py-2 mb-3"
        />

        <Text className="text-sm font-medium mb-1">
          {tr.series.createCityLabel}
        </Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          className="border border-gray-200 rounded px-3 py-2 mb-3"
        />

        <Text className="text-sm font-medium mb-1">
          {tr.series.createDistrictLabel}
        </Text>
        <TextInput
          value={district}
          onChangeText={setDistrict}
          className="border border-gray-200 rounded px-3 py-2 mb-3"
        />

        <Text className="text-sm font-medium mb-1">
          {tr.series.createTeamModeLabel}
        </Text>
        <View className="flex-row gap-2 mb-1">
          {(['MIXED', 'FIXED'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setTeamMode(mode)}
              className={`flex-1 px-3 py-2 rounded ${teamMode === mode ? 'bg-blue-600' : 'bg-gray-100'}`}>
              <Text
                className={
                  teamMode === mode
                    ? 'text-white text-center'
                    : 'text-gray-700 text-center'
                }>
                {mode === 'MIXED'
                  ? tr.series.teamModeMixed
                  : tr.series.teamModeFixed}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-gray-500 mb-3">
          {teamMode === 'MIXED'
            ? tr.series.createTeamModeMixedHint
            : tr.series.createTeamModeFixedHint}
        </Text>

        {teamMode === 'FIXED' ? (
          <View className="mb-3">
            <Text className="text-sm font-medium mb-1">
              {tr.series.createFixedTeamAName}
            </Text>
            <TextInput
              value={teamAName}
              onChangeText={setTeamAName}
              className="border border-gray-200 rounded px-3 py-2 mb-2"
            />
            <View className="flex-row gap-2 mb-3">
              {COLOR_PALETTE.map((c) => (
                <Pressable
                  key={`a-${c}`}
                  onPress={() => setTeamAColor(c)}
                  style={{
                    backgroundColor: c,
                    borderWidth: teamAColor === c ? 3 : 0,
                    borderColor: '#000',
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                  }}
                />
              ))}
            </View>

            <Text className="text-sm font-medium mb-1">
              {tr.series.createFixedTeamBName}
            </Text>
            <TextInput
              value={teamBName}
              onChangeText={setTeamBName}
              className="border border-gray-200 rounded px-3 py-2 mb-2"
            />
            <View className="flex-row gap-2">
              {COLOR_PALETTE.map((c) => (
                <Pressable
                  key={`b-${c}`}
                  onPress={() => setTeamBColor(c)}
                  style={{
                    backgroundColor: c,
                    borderWidth: teamBColor === c ? 3 : 0,
                    borderColor: '#000',
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => mut.mutate()}
          disabled={submitDisabled}
          className={`mt-4 py-3 rounded ${submitDisabled ? 'bg-gray-300' : 'bg-blue-600'} active:opacity-80`}>
          <Text className="text-white text-center font-medium">
            {mut.isPending
              ? tr.series.createSubmitting
              : tr.series.createSubmit}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
