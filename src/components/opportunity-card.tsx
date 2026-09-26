import * as WebBrowser from 'expo-web-browser';
import { Bookmark, Building2, CalendarClock, CircleCheck, ExternalLink, MapPin, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { SourceChips } from '@/components/research-report';
import { tierColors } from '@/components/score';
import { Badge, Button, Card, Text } from '@/components/ui';
import type { Opportunity, OpportunitySource } from '@/data/types';
import { t } from '@/i18n';
import { scoreTier } from '@/lib/scores';
import { colors, radius, spacing } from '@/theme/tokens';

function open(url: string) {
  if (url) WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

function Bullets({ title, items, tone }: { title: string; items: string[]; tone?: 'amber' }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.bullets}>
      <Text variant="caption" color={tone === 'amber' ? 'amber' : 'textMuted'}>
        {title}
      </Text>
      {items.map((item, index) => (
        <Text key={index} variant="callout" color="textSecondary">
          • {item}
        </Text>
      ))}
    </View>
  );
}

export function OpportunityCard({
  opportunity,
  sources,
  saved,
  onToggleSave,
  compact = false,
}: {
  opportunity: Opportunity;
  sources?: OpportunitySource[];
  saved: boolean;
  onToggleSave: () => void;
  compact?: boolean;
}) {
  const fitColor = tierColors[scoreTier(opportunity.fit)];
  const remote = t('opportunities.remoteLabel');
  const place =
    opportunity.remote && !opportunity.location.toLowerCase().includes(remote.toLowerCase())
      ? [opportunity.location, remote].filter(Boolean).join(' · ')
      : opportunity.location;
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{opportunity.title}</Text>
          <View style={styles.inline}>
            <Building2 size={13} color={colors.textMuted} />
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
              {opportunity.organization}
            </Text>
          </View>
          {place ? (
            <View style={styles.inline}>
              <MapPin size={13} color={colors.textMuted} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flexShrink}>
                {place}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.fit, { borderColor: fitColor }]} accessibilityLabel={t('opportunities.fit', { n: opportunity.fit })}>
          <Text variant="caption" style={{ color: fitColor, fontWeight: '800' }}>
            {opportunity.fit}%
          </Text>
        </View>
      </View>

      <View style={styles.badges}>
        <Badge label={t(`career.targets.${opportunity.type}`)} tone="primary" />
        <Badge label={t(`career.platforms.${opportunity.platform}`)} tone="accent" />
        {opportunity.verified ? (
          <Badge icon={CircleCheck} tone="success" label={t('opportunities.verified')} />
        ) : (
          <Badge icon={TriangleAlert} tone="amber" label={t('opportunities.unverified')} />
        )}
      </View>

      {(opportunity.deadline || opportunity.startDate) && (
        <View style={styles.inline}>
          <CalendarClock size={14} color={colors.amber} />
          <Text variant="caption" color="textSecondary" style={styles.flexShrink}>
            {[
              opportunity.deadline ? `${t('opportunities.deadline')}: ${opportunity.deadline}` : '',
              opportunity.startDate ? `${t('opportunities.start')}: ${opportunity.startDate}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      )}

      {!compact && (
        <>
          {opportunity.reasons.map((reason, index) => (
            <Text key={index} variant="callout" color="successLight">
              ✓ {reason}
            </Text>
          ))}
          <Bullets title={t('opportunities.requirements')} items={opportunity.requirements} />
          <Bullets title={t('opportunities.gaps')} items={opportunity.gaps} tone="amber" />
          {sources && <SourceChips ids={opportunity.sourceIds} sources={sources} />}
        </>
      )}

      <View style={styles.actions}>
        <Button title={t('opportunities.apply')} icon={ExternalLink} size="sm" onPress={() => open(opportunity.url)} style={styles.flex} />
        <Button
          title={saved ? t('opportunities.unsave') : t('opportunities.save')}
          icon={Bookmark}
          variant="secondary"
          size="sm"
          onPress={onToggleSave}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  card: {
    gap: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fit: {
    minWidth: 48,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bullets: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
