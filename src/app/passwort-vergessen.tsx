import { Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthCaptcha } from '@/components/auth/auth-captcha';
import type { AuthCaptchaHandle } from '@/components/auth/auth-captcha.types';
import { AuthField, AuthLayout, InlineNotice } from '@/components/auth/auth-layout';
import { ActionButton, AppText } from '@/components/ui/primitives';
import { Palette, Space } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { hCaptchaSiteKey, isHCaptchaConfigured } from '@/lib/hcaptcha';
import { translateAuthError } from '@/utils/auth-errors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const captchaRef = useRef<AuthCaptchaHandle>(null);
  const { requestPasswordReset, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    if (!isHCaptchaConfigured) {
      setError('hCaptcha ist noch nicht konfiguriert.');
      return;
    }
    if (!captchaToken) {
      setError('Bitte bestätige zuerst die hCaptcha-Prüfung.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await requestPasswordReset(normalizedEmail, captchaToken);
    captchaRef.current?.reset();
    setSubmitting(false);
    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      eyebrow="KONTO WIEDERHERSTELLEN"
      title="Passwort zurücksetzen"
      description="Du erhältst einen sicheren Supabase-Link, über den du im Account ein neues Passwort festlegen kannst."
      footer={
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login' as Href)} style={({ pressed }) => pressed && styles.pressed}>
          <AppText variant="bodyStrong" color={Palette.forest}>Zurück zur Anmeldung</AppText>
        </Pressable>
      }>
      <View style={styles.form}>
        {!isConfigured && <InlineNotice tone="info">Supabase ist noch nicht konfiguriert.</InlineNotice>}
        {!isHCaptchaConfigured && (
          <InlineNotice tone="info">
            hCaptcha ist noch nicht konfiguriert. Passwort-Links werden erst
            nach dem Hinterlegen des öffentlichen Sitekeys freigeschaltet.
          </InlineNotice>
        )}
        {error && <InlineNotice>{error}</InlineNotice>}
        {sent ? (
          <>
            <InlineNotice tone="success">Wenn ein Konto für diese Adresse existiert, wurde der Link versendet. Bitte prüfe auch den Spam-Ordner.</InlineNotice>
            <ActionButton label="Zur Anmeldung" icon="arrow" onPress={() => router.replace('/login' as Href)} />
          </>
        ) : (
          <>
            <AuthField
              label="E-Mail-Adresse"
              placeholder="name@beispiel.de"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            {isHCaptchaConfigured && (
              <AuthCaptcha
                ref={captchaRef}
                siteKey={hCaptchaSiteKey}
                verified={Boolean(captchaToken)}
                disabled={submitting}
                onTokenChange={setCaptchaToken}
                onError={setError}
              />
            )}
            <ActionButton
              label={submitting ? 'Wird versendet …' : 'Link anfordern'}
              icon="messages"
              disabled={
                submitting ||
                !isConfigured ||
                !isHCaptchaConfigured ||
                !captchaToken
              }
              onPress={() => void submit()}
            />
          </>
        )}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: Space.lg },
  pressed: { opacity: 0.7 },
});
