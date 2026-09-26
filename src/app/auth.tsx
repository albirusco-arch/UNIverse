import { router } from 'expo-router';
import { BadgeCheck, Check, KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { Button, Header, Input, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { REVIEW_EMAIL, SUPPORT_EMAIL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { isStudentEmail, universityForEmail } from '@/lib/student-email';
import { isDemoMode } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

/** The sign-up trigger rejects non-university addresses with this Supabase error. */
function authErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (/database error saving new user|university email/i.test(message)) return t('auth.notUniversity');
  return message || t('common.error');
}

function suggestUniversity(email: string) {
  const subject = encodeURIComponent('University not recognised');
  const body = encodeURIComponent(`My university email domain is not accepted: ${email.split('@')[1] ?? ''}`);
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => undefined);
}

export default function AuthScreen() {
  const { sendCode, verifyCode, signInWithPassword } = useSession();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);

  const normalized = email.trim().toLowerCase();
  const detected = universityForEmail(normalized);

  const submitEmail = async () => {
    if (!isStudentEmail(normalized)) {
      setRejected(true);
      return setError(t('auth.notUniversity'));
    }
    setRejected(false);
    if (!accepted) return setError(t('auth.acceptTerms'));
    setError(null);
    if (REVIEW_EMAIL && normalized === REVIEW_EMAIL && !isDemoMode) {
      setEmail(normalized);
      setStep('password');
      return;
    }
    setBusy(true);
    try {
      await sendCode(normalized);
      setEmail(normalized);
      setStep('code');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const finishSignIn = async (signIn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
      // The tabs layout sends new users on to profile setup.
      router.replace('/');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = () => {
    if (!/^\d{6}$/.test(code.trim())) return;
    return finishSignIn(() => verifyCode(email, code.trim()));
  };

  const submitPassword = () => {
    if (!password) return;
    return finishSignIn(() => signInWithPassword(email, password));
  };

  return (
    <Screen
      header={<Header />}
      footer={
        step === 'email' ? (
          <Button title={t('auth.sendCode')} icon={Mail} onPress={submitEmail} loading={busy} />
        ) : step === 'password' ? (
          <Button title={t('common.signIn')} icon={KeyRound} onPress={submitPassword} loading={busy} disabled={!password} />
        ) : (
          <Button title={t('auth.verify')} icon={KeyRound} onPress={submitCode} loading={busy} disabled={code.trim().length !== 6} />
        )
      }>
      <View style={styles.intro}>
        <LogoMark size={72} />
        <Text variant="title1">{step === 'code' ? t('auth.codeTitle') : t('auth.title')}</Text>
        <Text variant="body" color="textSecondary">
          {step === 'code' ? t('auth.codeBody', { email }) : step === 'password' ? email : t('auth.body')}
        </Text>
      </View>

      {step === 'email' ? (
        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setRejected(false);
              setError(null);
            }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={submitEmail}
          />
          {detected && (
            <View style={styles.detected}>
              <BadgeCheck size={16} color={colors.success} />
              <Text variant="callout" color="success" style={styles.flex} numberOfLines={2}>
                {t('auth.detected', { name: detected.name })}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => setAccepted((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            style={styles.terms}>
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              {accepted && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text variant="callout" color="textSecondary" style={styles.termsText}>
              {t('auth.terms')}
            </Text>
          </Pressable>
          <View style={styles.links}>
            <Text variant="caption" color="primaryLight" onPress={() => router.push('/legal/terms')} accessibilityRole="link">
              {t('settings.terms')}
            </Text>
            <Text variant="caption" color="primaryLight" onPress={() => router.push('/legal/guidelines')} accessibilityRole="link">
              {t('settings.guidelines')}
            </Text>
            <Text variant="caption" color="primaryLight" onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
              {t('settings.privacy')}
            </Text>
          </View>
        </View>
      ) : step === 'password' ? (
        <View style={styles.form}>
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            autoFocus
            onSubmitEditing={submitPassword}
          />
          <Button title={t('auth.changeEmail')} variant="ghost" size="sm" onPress={() => setStep('email')} />
        </View>
      ) : (
        <View style={styles.form}>
          <Input
            label={t('auth.code')}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={styles.codeInput}
            onSubmitEditing={submitCode}
          />
          {isDemoMode && (
            <Text variant="caption" color="amber">
              {t('auth.demoHint')}
            </Text>
          )}
          <Button title={t('auth.changeEmail')} variant="ghost" size="sm" onPress={() => setStep('email')} />
        </View>
      )}

      {error && (
        <Text variant="callout" color="red" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      {rejected && step === 'email' && (
        <Text
          variant="callout"
          color="primaryLight"
          style={styles.suggest}
          onPress={() => suggestUniversity(normalized)}
          accessibilityRole="link">
          {t('auth.missingUniversity')}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  detected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  flex: {
    flex: 1,
  },
  terms: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginLeft: 34,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '700',
  },
  error: {
    marginTop: spacing.lg,
  },
  suggest: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
});
