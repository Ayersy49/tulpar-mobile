import { Stack } from 'expo-router';
import { tr } from '../../../src/i18n/tr';

// S1C: the Seriler tab is a Stack so create / pool / chat / [id] all push
// onto the same nav. headerShown:false on the list lets the screen render
// its own header with the "Yeni seri oluştur" CTA inline.
export default function SeriesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: tr.series.createTitle, presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: '' }} />
      <Stack.Screen name="[id]/edit" options={{ title: tr.series.editFixedCta, presentation: 'modal' }} />
      <Stack.Screen name="[id]/pool" options={{ title: tr.series.poolHeader }} />
      <Stack.Screen name="[id]/chat" options={{ title: tr.series.chatCta }} />
    </Stack>
  );
}
