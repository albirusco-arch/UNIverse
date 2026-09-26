import { Redirect, router } from 'expo-router';
import { Mail, MessageCircle, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { GradientText } from '@/components/gradient-text';
import { Button, IconTile, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { gradients, spacing, type } from '@/theme/tokens';

const features: { icon: LucideIcon; colors: typeof gradients.primary; title: () => string; body: () => string }[] = [
  { icon: Sparkles, colors: gradients.primary, title: () => t('welcome.feature1Title'), body: () => t('welcome.feature1Body') },
  { icon: ShieldCheck, colors: gradients.success, title: () => t('welcome.feature2Title'), body: () => t('welcome.feature2Body') },
  { icon: MessageCircle, colors: gradients.accent, title: () => t('welcome.feature3Title'), body: () => t('welcome.feature3Body') },
];

export default function WelcomeScreen() {
  const { signedIn } = useSession();
  if (signedIn) return <Redirect href="/" />;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button title={t('welcome.cta')} icon={Mail} onPress={() => router.push('/auth')} />
          <Text variant="caption" color="textMuted" align="center">
            {t('welcome.legal')}
          </Text>
        </View>
      }>
      <View style={styles.lockup}>
        <LogoMark size={190} />
        <Text style={styles.logotype}>UNIVERSE</Text>
      </View>
      <View style={styles.hero}>
        <Text variant="display">{t('welcome.title')}</Text>
        <GradientText text={t('welcome.accent')} style={type.display} />
        <Text variant="body" color="textSecondary" style={styles.body}>
          {t('welcome.body')}
        </Text>
      </View>
      <View style={styles.features}>
        {features.map((feature) => (
          <View key={feature.title()} style={styles.feature}>
            <IconTile icon={feature.icon} colors={feature.colors} size={44} />
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
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  logotype: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 10,
    marginLeft: 10,
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
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    gap: spacing.sm,
  },
});
