import { Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthCaptcha } from '@/components/auth/auth-captcha';
import type { AuthCaptchaHandle } from '@/components/auth/auth-captcha.types';
import { AuthField, AuthLayout, InlineNotice } from '@/components/auth/auth-layout';
import { ActionButton, AppText } from '@/components/ui/primitives';
import { Palette, Space } from '@/constants/design';
import { useAuth } from '@/context/auth-context';
import { hCaptchaSiteKey, isHCaptchaConfigured } from '@/lib/hcaptcha';
import { translateAuthError } from '@/utils/auth-errors';

export default function LoginScreen() {
  const router = useRouter();
  const captchaRef = useRef<AuthCaptchaHandle>(null);
  const { signIn, isAuthenticated, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard' as Href);
  }, [isAuthenticated, router]);

  async function submit() {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Bitte fülle beide Felder aus.');
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
    const result = await signIn(normalizedEmail, password, captchaToken);
    captchaRef.current?.reset();
    setSubmitting(false);

    if (result.error) {
      setError(translateAuthError(result.error));
      return;
    }

    router.replace('/dashboard' as Href);
  }

  return (
    <AuthLayout
      eyebrow="WILLKOMMEN ZURÜCK"
      title="Anmelden"
      description="Melde dich an, um den geschützten Akademiebereich zu öffnen."
      footer={
        <View style={styles.footerRow}>
          <AppText color={Palette.inkSoft}>Noch kein Konto?</AppText>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/register' as Href)}
            style={({ pressed }) => pressed && styles.pressed}>
            <AppText variant="bodyStrong" color={Palette.forest}>
              Jetzt registrieren
            </AppText>
          </Pressable>
        </View>
      }>
      <View style={styles.form}>
        {!isConfigured && (
          <InlineNotice tone="info">
            Supabase ist noch nicht verbunden. Trage zuerst URL und Publishable Key in deiner
            `.env`-Datei ein.
          </InlineNotice>
        )}
        {!isHCaptchaConfigured && (
          <InlineNotice tone="info">
            hCaptcha ist noch nicht konfiguriert. Die Anmeldung wird erst nach
            dem Hinterlegen des öffentlichen Sitekeys freigeschaltet.
          </InlineNotice>
        )}
        {error && <InlineNotice>{error}</InlineNotice>}
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
          returnKeyType="next"
        />
        <AuthField
          label="Passwort"
          placeholder="Dein Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/passwort-vergessen' as Href)}
          style={({ pressed }) => [styles.resetLink, pressed && styles.pressed]}>
          <AppText variant="small" color={Palette.forest}>Passwort vergessen?</AppText>
        </Pressable>
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
          label={submitting ? 'Wird angemeldet …' : 'Anmelden'}
          icon="arrow"
          disabled={
            submitting ||
            !isConfigured ||
            !isHCaptchaConfigured ||
            !captchaToken
          }
          onPress={() => void submit()}
          style={styles.submitButton}
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: Space.lg },
  submitButton: { width: '100%', marginTop: Space.sm },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  resetLink: { alignSelf: 'flex-end' },
  pressed: { opacity: 0.7 },
});
