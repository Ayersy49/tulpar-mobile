import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/auth/store';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return <Redirect href={accessToken ? '/(authed)/health' : '/(auth)/login'} />;
}
