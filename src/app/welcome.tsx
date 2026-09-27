import { Redirect, router } from 'expo-router';
import { Briefcase, Camera, Compass, LogIn, Play, ShieldCheck, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Lockup } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { isDemoMode } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

const features: { icon: LucideIcon; title: () => string; body: () => string }[] = [
  { icon: Briefcase, title: () => t('welcome.feature1Title'), body: () => t('welcome.feature1Body') },
  { icon: Camera, title: () => t('welcome.feature2Title'), body: () => t('welcome.feature2Body') },
  { icon: ShieldCheck, title: () => t('welcome.feature3Title'), body: () => t('welcome.feature3Body') },
];

export default function WelcomeScreen() {
  const { signedIn, continueAsGuest, startDemo } = useSession();
  const [starting, setStarting] = useState(false);
  if (signedIn) return <Redirect href="/" />;

  const tryDemo = async () => {
    setStarting(true);
    try {
      await startDemo();
      router.replace('/');
    } finally {
      setStarting(false);
    }
  };

  const explore = async () => {
    await continueAsGuest();
    router.replace('/explore');
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {isDemoMode && (
            <>
              <Button title={t('welcome.demo')} icon={Play} onPress={tryDemo} loading={starting} />
              <Text variant="caption" color="amber" align="center">
                {t('welcome.demoBody')}
              </Text>
            </>
          )}
          <View style={styles.row}>
            <Button
              title={t('welcome.login')}
              icon={LogIn}
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })}
            />
            <Button
              title={t('welcome.signup')}
              icon={UserPlus}
              variant={isDemoMode ? 'secondary' : 'primary'}
              style={styles.flex}
              onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
            />
          </View>
          <Button title={t('welcome.guest')} icon={Compass} variant="ghost" onPress={explore} />
          <Text variant="caption" color="textMuted" align="center">
            {t('welcome.legal')}
          </Text>
        </View>
      }>
      <View style={styles.lockup}>
        <Lockup width={150} />
      </View>
      <View style={styles.hero}>
        <Text variant="title1">{t('welcome.title')}</Text>
        <Text variant="body" color="textSecondary" style={styles.body}>
          {t('welcome.body')}
        </Text>
      </View>
      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature.title()} style={styles.feature}>
            <feature.icon size={20} color={colors.textSecondary} strokeWidth={1.8} style={styles.featureIcon} />
            <View style={styles.featureText}>
              <Text variant="bodyStrong">{feature.title()}</Text>
              <Text variant="callout" color="textMuted">
                {feature.body()}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'flex-start',
    marginTop: spacing.xl,
  },
  hero: {
    marginTop: spacing.xxxl,
  },
  body: {
    marginTop: spacing.md,
  },
  features: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
