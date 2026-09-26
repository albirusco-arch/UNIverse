import { router } from 'expo-router';
import { ChevronRight, FileText, Lock } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, IconTile, Text } from '@/components/ui';
import { t } from '@/i18n';
import { colors, gradients, spacing } from '@/theme/tokens';

/** Entry point to the Premium CV analysis: visible to everyone, locked until it launches. */
export function CvAnalysisCard() {
  return (
    <Card
      tone="accent"
      onPress={() => router.push('/cv')}
      accessibilityLabel={`${t('premium.cvTitle')}, ${t('premium.badge')}, ${t('premium.comingSoon')}`}
      style={styles.card}>
      <IconTile icon={FileText} colors={gradients.accent} size={44} />
      <View style={styles.text}>
        <View style={styles.badges}>
          <Badge tone="accent" icon={Lock} label={t('premium.badge')} />
          <Badge tone="amber" label={t('premium.comingSoon')} />
        </View>
        <Text variant="bodyStrong">{t('premium.cvTitle')}</Text>
        <Text variant="caption" color="textMuted">
          {t('premium.cvBody')}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
