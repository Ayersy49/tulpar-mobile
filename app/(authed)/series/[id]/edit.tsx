import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import {
  getSeries,
  updateSeries,
  type UpdateSeriesPayload,
} from '../../../../src/api/series';
import { tr } from '../../../../src/i18n/tr';

// S1C: authority edit screen for series-level fields. teamMode and team
// composition (FIXED teams) are immutable post-create per backend
// UpdateSeriesDto — only the schedule + location + price are editable.
export default function SeriesEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const seriesQuery = useQuery({
    queryKey: ['series', id],
    queryFn: () => getSeries(id!),
    enabled: !!id,
  });

  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');

  useEffect(() => {
    const s = seriesQuery.data;
    if (!s) return;
    setTitle(s.title);
    setDayOfWeek(s.dayOfWeek);
    setTimeOfDay(s.timeOfDay);
    setDurationMin(String(s.durationMin));
    setCity(s.city ?? '');
    setDistrict(s.district ?? '');
  }, [seriesQuery.data]);

  const mut = useMutation({
    mutationFn: () => {
      const payload: UpdateSeriesPayload = {
        title: title.trim(),
        dayOfWeek,
        timeOfDay,
        durationMin: Number(durationMin) || 60,
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(district.trim() ? { district: district.trim() } : {}),
      };
      return updateSeries(id!, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['series', id] });
      qc.invalidateQueries({ queryKey: ['series'] });
      router.back();
    },
    onError: (e: Error) => Alert.alert(tr.common.error, e.message),
  });

  if (seriesQuery.isLoading || !seriesQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

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
              <Text className={dayOfWeek === i ? 'text-white' : 'text-gray-700'}>
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

        <Pressable
          onPress={() => mut.mutate()}
          disabled={mut.isPending || !title.trim()}
          className={`mt-4 py-3 rounded ${
            mut.isPending || !title.trim() ? 'bg-gray-300' : 'bg-blue-600'
          } active:opacity-80`}>
          <Text className="text-white text-center font-medium">
            {mut.isPending ? tr.common.saving : tr.common.save}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
