import { Text, View } from 'react-native';
import { tr } from '../i18n/tr';

export function SeriesBadge() {
  return (
    <View className="bg-blue-900 px-2 py-0.5 rounded">
      <Text className="text-white text-[10px] font-bold tracking-wide">
        {tr.publicSeriesBadge}
      </Text>
    </View>
  );
}
