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
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { tr } from '../../src/i18n/tr';

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, { message: tr.auth.invalidPhone }),
});
type PhoneForm = z.infer<typeof phoneSchema>;

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { message: tr.auth.invalidCode }),
});
type CodeForm = z.infer<typeof codeSchema>;

type Step = 'phone' | 'code';

export default function LoginScreen() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onRequestOtp = async ({ phone: p }: PhoneForm) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await apiFetch('/auth/otp/request', {
        method: 'POST',
        body: { phone: p },
        auth: false,
      });
      setPhone(p);
      setStep('code');
    } catch (e) {
      setServerError((e as Error).message || tr.auth.requestFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async ({ code }: CodeForm) => {
    setSubmitting(true);
    setServerError(null);
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
              <Text className="text-base font-semibold">
                {tr.auth.phoneLabel}
              </Text>
              <Controller
                control={phoneForm.control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-base"
                    placeholder={tr.auth.phonePlaceholder}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    autoCorrect={false}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!submitting}
                  />
                )}
              />
              {phoneForm.formState.errors.phone ? (
                <Text className="text-sm text-red-600">
                  {phoneForm.formState.errors.phone.message}
                </Text>
              ) : (
                <Text className="text-sm text-gray-500">
                  {tr.auth.phoneHelper}
                </Text>
              )}

              {serverError ? (
                <Text className="text-sm text-red-600">{serverError}</Text>
              ) : null}

              <Pressable
                className="bg-blue-600 rounded-lg p-4 active:opacity-80"
                disabled={submitting}
                onPress={phoneForm.handleSubmit(onRequestOtp)}>
                <Text className="text-white text-center font-semibold">
                  {submitting ? tr.common.loading : tr.auth.requestOtp}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-base font-semibold">
                {tr.auth.codeLabel}
              </Text>
              <Controller
                control={codeForm.control}
                name="code"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-base tracking-widest"
                    placeholder={tr.auth.codePlaceholder}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="one-time-code"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!submitting}
                  />
                )}
              />
              {codeForm.formState.errors.code ? (
                <Text className="text-sm text-red-600">
                  {codeForm.formState.errors.code.message}
                </Text>
              ) : (
                <Text className="text-sm text-gray-500">
                  {tr.auth.codeHelper}
                </Text>
              )}

              {serverError ? (
                <Text className="text-sm text-red-600">{serverError}</Text>
              ) : null}

              <Pressable
                className="bg-blue-600 rounded-lg p-4 active:opacity-80"
                disabled={submitting}
                onPress={codeForm.handleSubmit(onVerify)}>
                <Text className="text-white text-center font-semibold">
                  {submitting ? tr.common.loading : tr.auth.verify}
                </Text>
              </Pressable>

              <Pressable
                className="p-2 active:opacity-60"
                disabled={submitting}
                onPress={() => {
                  setServerError(null);
                  codeForm.reset();
                  setStep('phone');
                }}>
                <Text className="text-center text-blue-700">
                  {tr.auth.backToPhone}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
