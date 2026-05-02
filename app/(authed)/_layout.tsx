import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/auth/store';

export default function AuthedLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
