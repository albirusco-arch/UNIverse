import { CheckCircle2, FileText, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Header, IconTile, Screen, Text } from '@/components/ui';
import { currentUserId } from '@/data/api';
import { t } from '@/i18n';
import { premiumAccess } from '@/lib/premium';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

/**
 * Placeholder for the Premium CV analysis. There is no payment provider and no
 * analysis yet: the screen only explains the feature and stays locked.
 */
export default function CvAnalysisScreen() {
  const { signedIn } = useSession();
  const { data: access } = useQuery(async () => premiumAccess('cv_analysis', await currentUserId()), [signedIn]);
  const points = [t('premium.cvPoint1'), t('premium.cvPoint2'), t('premium.cvPoint3')];

  return (
    <Screen
      header={<Header />}
      footer={
        <View style={styles.footer}>
          <Button title={t('premium.comingSoon')} icon={Lock} disabled />
          {access !== 'available' && (
            <Text variant="caption" color="textMuted" align="center">
              {t('premium.locked')}
            </Text>
          )}
        </View>
      }>
      <View style={styles.intro}>
        <IconTile icon={FileText} colors={gradients.accent} size={56} />
        <View style={styles.badges}>
          <Badge tone="accent" icon={Lock} label={t('premium.badge')} />
          <Badge tone="amber" label={t('premium.comingSoon')} />
        </View>
        <Text variant="title1">{t('premium.cvTitle')}</Text>
        <Text variant="body" color="textSecondary">
          {t('premium.cvScreenBody')}
        </Text>
      </View>
      <Card style={styles.points}>
        {points.map((point) => (
          <View key={point} style={styles.point}>
            <CheckCircle2 size={18} color={colors.accentLight} />
            <Text variant="callout" style={styles.flex}>
              {point}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  points: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  point: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  footer: {
    gap: spacing.sm,
  },
});
