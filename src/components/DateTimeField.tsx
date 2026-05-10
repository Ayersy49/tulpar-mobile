import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { tr } from '../i18n/tr';

type Mode = 'date' | 'datetime';

type Props = {
  label: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
  mode?: Mode;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  allowClear?: boolean;
  errorMessage?: string;
  disabled?: boolean;
};

function formatValue(value: Date, mode: Mode): string {
  const dd = String(value.getDate()).padStart(2, '0');
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const yyyy = value.getFullYear();
  if (mode === 'date') return `${dd}.${mm}.${yyyy}`;
  const hh = String(value.getHours()).padStart(2, '0');
  const mi = String(value.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

// Cross-platform date/datetime picker. Android uses the imperative
// DateTimePickerAndroid.open API (and chains date → time when mode is
// 'datetime'). iOS renders the inline picker conditionally and runs through
// a date phase then a time phase before committing onChange.
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'date',
  placeholder,
  minimumDate,
  maximumDate,
  allowClear = true,
  errorMessage,
  disabled = false,
}: Props) {
  const [iosVisible, setIosVisible] = useState(false);
  const [iosPhase, setIosPhase] = useState<'date' | 'time'>('date');
  const [iosTempDate, setIosTempDate] = useState<Date | null>(null);

  const openAndroid = () => {
    const initial = value ?? new Date();
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        if (mode === 'date') {
          onChange(date);
          return;
        }
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return;
            const merged = new Date(date);
            merged.setHours(time.getHours());
            merged.setMinutes(time.getMinutes());
            merged.setSeconds(0, 0);
            onChange(merged);
          },
        });
      },
    });
  };

  const openIos = () => {
    setIosTempDate(value ?? new Date());
    setIosPhase('date');
    setIosVisible(true);
  };

  const handleIosChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed') {
      setIosVisible(false);
      return;
    }
    if (!picked) return;
    if (mode === 'date') {
      onChange(picked);
      setIosVisible(false);
      return;
    }
    if (iosPhase === 'date') {
      setIosTempDate(picked);
      setIosPhase('time');
      return;
    }
    const merged = new Date(iosTempDate ?? picked);
    merged.setHours(picked.getHours());
    merged.setMinutes(picked.getMinutes());
    merged.setSeconds(0, 0);
    onChange(merged);
    setIosVisible(false);
  };

  const placeholderText = placeholder ?? tr.dateTimeField.placeholder;

  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold text-gray-700">{label}</Text>
      <View className="flex-row gap-2 items-center">
        <Pressable
          disabled={disabled}
          onPress={Platform.OS === 'android' ? openAndroid : openIos}
          className={`flex-1 border rounded-lg p-3 ${
            errorMessage
              ? 'border-red-500 bg-white'
              : disabled
                ? 'border-gray-200 bg-gray-100'
                : 'border-gray-300 bg-white'
          }`}>
          <Text
            className={
              value
                ? disabled
                  ? 'text-base text-gray-700'
                  : 'text-base text-gray-900'
                : 'text-base text-gray-400'
            }>
            {value ? formatValue(value, mode) : placeholderText}
          </Text>
        </Pressable>
        {!disabled && allowClear && value ? (
          <Pressable
            onPress={() => onChange(null)}
            className="border border-gray-300 bg-white rounded-lg px-3 py-3 active:opacity-80">
            <Text className="text-sm text-gray-700">
              {tr.dateTimeField.clear}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {errorMessage ? (
        <Text className="text-xs text-red-600">{errorMessage}</Text>
      ) : null}
      {Platform.OS === 'ios' && iosVisible ? (
        <DateTimePicker
          value={iosTempDate ?? value ?? new Date()}
          mode={mode === 'datetime' ? iosPhase : 'date'}
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleIosChange}
        />
      ) : null}
    </View>
  );
}
