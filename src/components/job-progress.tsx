import { ActivityIndicator, StyleSheet } from 'react-native';

import { LogoMark } from '@/components/brand';
import { Card, Text } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

/** "AI is working" card shown while a background job runs. */
export function JobProgress({ title, body }: { title: string; body: string }) {
  return (
    <Card tone="primary" style={styles.card}>
      <LogoMark size={88} />
      <Text variant="title3" align="center">
        {title}
      </Text>
      <ActivityIndicator color={colors.primaryLight} />
      <Text variant="caption" color="textMuted" align="center" accessibilityLiveRegion="polite">
        {body}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxxl,
    marginTop: spacing.lg,
  },
});
