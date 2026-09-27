import * as WebBrowser from 'expo-web-browser';
import { ArrowUpRight } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Text } from '@/components/ui';
import type { Opportunity } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji, formatDate } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

/** One listing; tapping opens the original page, where students apply or book. */
export const OpportunityCard = memo(function OpportunityCard({ item }: { item: Opportunity }) {
  const place = [item.city, item.countryCode ? flagEmoji(item.countryCode) : ''].filter(Boolean).join(' ');
  const when = item.startsAt
    ? t('opportunities.on', { date: formatDate(item.startsAt) })
    : item.deadline
      ? t('opportunities.applyBy', { date: formatDate(item.deadline) })
      : null;

  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(item.url)}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}, ${item.organization}. ${t('opportunities.open')}`}
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfacePressed }]}>
      <View style={styles.head}>
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
          {t(`opportunities.kinds.${item.kind}`)} · {t(`opportunities.sources.${item.source}`)}
        </Text>
        <ArrowUpRight size={16} color={colors.textMuted} />
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {item.title}
      </Text>
      <Text variant="callout" color="textSecondary" numberOfLines={1}>
        {[item.organization, place].filter(Boolean).join(' · ')}
      </Text>
      {(when || item.remote || !item.verified) && (
        <View style={styles.badges}>
          {when ? <Badge label={when} /> : null}
          {item.remote ? <Badge label={t('opportunities.remoteBadge')} /> : null}
          {!item.verified ? <Badge label={t('opportunities.unverified')} tone="amber" /> : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
});
