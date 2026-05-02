import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { tr } from '../../src/i18n/tr';

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const CODE_RE = /^\d{6}$/;

type Step = 'phone' | 'code';

export default function LoginScreen() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onRequestOtp = async () => {
    setServerError(null);
    if (!PHONE_RE.test(phone)) {
      setPhoneError(tr.auth.invalidPhone);
      return;
    }
    setPhoneError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/otp/request', {
        method: 'POST',
        body: { phone },
        auth: false,
      });
      setCode('');
      setCodeError(null);
      setStep('code');
    } catch (e) {
      setServerError((e as Error).message || tr.auth.requestFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    setServerError(null);
    if (!CODE_RE.test(code)) {
      setCodeError(tr.auth.invalidCode);
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        isNewUser: boolean;
      }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code, kvkkConsent: true },
        auth: false,
      });
      await setTokens(res.accessToken, res.refreshToken);
      router.replace('/(authed)/health');
    } catch (e) {
      setServerError((e as Error).message || tr.auth.verifyFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 p-6 gap-6 justify-center">
          <Text className="text-4xl font-bold text-center">{tr.auth.title}</Text>

          {step === 'phone' ? (
            <View className="gap-3">
              <Text className="text-base font-semibold">{tr.auth.phoneLabel}</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-4 text-base"
                placeholder={tr.auth.phonePlaceholder}
                keyboardType="phone-pad"
                autoCorrect={false}
                onChangeText={setPhone}
                value={phone}
                editable={!submitting}
              />
              {phoneError ? (
                <Text className="text-sm text-red-600">{phoneError}</Text>
              ) : (
                <Text className="text-sm text-gray-500">{tr.auth.phoneHelper}</Text>
              )}

              {serverError ? (
                <Text className="text-sm text-red-600">{serverError}</Text>
              ) : null}

              <Pressable
                className="bg-blue-600 rounded-lg p-4 active:opacity-80"
                disabled={submitting}
                onPress={onRequestOtp}>
                <Text className="text-white text-center font-semibold">
                  {submitting ? tr.common.loading : tr.auth.requestOtp}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-base font-semibold">{tr.auth.codeLabel}</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-4 text-base"
                placeholder={tr.auth.codePlaceholder}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                onChangeText={setCode}
                value={code}
                editable={!submitting}
              />
              {codeError ? (
                <Text className="text-sm text-red-600">{codeError}</Text>
              ) : (
                <Text className="text-sm text-gray-500">{tr.auth.codeHelper}</Text>
              )}

              {serverError ? (
                <Text className="text-sm text-red-600">{serverError}</Text>
              ) : null}

              <Pressable
                className="bg-blue-600 rounded-lg p-4 active:opacity-80"
                disabled={submitting}
                onPress={onVerify}>
                <Text className="text-white text-center font-semibold">
                  {submitting ? tr.common.loading : tr.auth.verify}
                </Text>
              </Pressable>

              <Pressable
                className="p-2 active:opacity-60"
                disabled={submitting}
                onPress={() => {
                  setServerError(null);
                  setCode('');
                  setCodeError(null);
                  setStep('phone');
                }}>
                <Text className="text-center text-blue-700">{tr.auth.backToPhone}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
