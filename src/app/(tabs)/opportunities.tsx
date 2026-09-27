import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowUpRight, Briefcase, MapPin, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useRequireAccount } from '@/components/account-gate';
import { OpportunityCard } from '@/components/opportunity-card';
import { Chip, ChipScroller, DemoBadge, EmptyState, IconButton, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { listOpportunities } from '@/data/api';
import { OPPORTUNITY_KINDS, OPPORTUNITY_SOURCES, type OpportunityKind, type OpportunitySource } from '@/data/types';
import { getLanguage, t } from '@/i18n';
import {
  EXTERNAL_PLATFORMS,
  externalSearchUrl,
  filterOpportunities,
  NO_OPPORTUNITY_FILTERS,
  type ExternalPlatform,
  type OpportunityFilter,
} from '@/lib/opportunities';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

const platformNames: Record<ExternalPlatform, string> = {
  linkedin: 'LinkedIn',
  handshake: 'Handshake',
  jobteaser: 'JobTeaser',
  eventbrite: 'Eventbrite',
};

/** Toggles one value in a multi-select filter. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function OpportunitiesScreen() {
  const requireAccount = useRequireAccount();
  const [filter, setFilter] = useState<OpportunityFilter>(NO_OPPORTUNITY_FILTERS);
  const { data: all, loading } = useQuery(listOpportunities, []);
  const results = all ? filterOpportunities(all, filter) : undefined;
  const update = (patch: Partial<OpportunityFilter>) => setFilter((current) => ({ ...current, ...patch }));

  const share = () => requireAccount('opportunities', () => router.push('/opportunity/new'));

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text variant="title1" accessibilityRole="header">
            {t('opportunities.title')}
          </Text>
          <DemoBadge />
        </View>
        <IconButton label={t('opportunities.share')} onPress={share} icon={<Plus size={20} color={colors.text} />} />
      </View>
      <Text variant="callout" color="textMuted" style={styles.subtitle}>
        {t('opportunities.body')}
      </Text>

      <View style={styles.filters}>
        <Input
          icon={Search}
          value={filter.query}
          onChangeText={(query) => update({ query })}
          placeholder={t('opportunities.searchPlaceholder')}
          autoCorrect={false}
          returnKeyType="search"
        />
        <Input
          icon={MapPin}
          value={filter.location}
          onChangeText={(location) => update({ location })}
          placeholder={t('opportunities.locationPlaceholder')}
          autoCorrect={false}
        />
        <ChipScroller>
          <Chip label={t('opportunities.allKinds')} selected={filter.kinds.length === 0} onPress={() => update({ kinds: [] })} />
          {OPPORTUNITY_KINDS.map((kind: OpportunityKind) => (
            <Chip
              key={kind}
              label={t(`opportunities.kinds.${kind}`)}
              selected={filter.kinds.includes(kind)}
              onPress={() => update({ kinds: toggle(filter.kinds, kind) })}
            />
          ))}
          <Chip label={t('opportunities.remote')} selected={filter.remoteOnly} onPress={() => update({ remoteOnly: !filter.remoteOnly })} />
        </ChipScroller>
        <ChipScroller>
          <Chip label={t('opportunities.allSources')} selected={filter.sources.length === 0} onPress={() => update({ sources: [] })} />
          {OPPORTUNITY_SOURCES.map((source: OpportunitySource) => (
            <Chip
              key={source}
              label={t(`opportunities.sources.${source}`)}
              selected={filter.sources.includes(source)}
              onPress={() => update({ sources: toggle(filter.sources, source) })}
            />
          ))}
        </ChipScroller>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('opportunities.inApp')} />
        {!results && loading && <ActivityIndicator color={colors.textMuted} />}
        {results?.length === 0 && <EmptyState icon={Briefcase} text={t('opportunities.empty')} />}
        <View style={styles.list}>
          {results?.map((item) => (
            <OpportunityCard key={item.id} item={item} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('opportunities.searchOnTitle')} />
        <Text variant="caption" color="textMuted" style={styles.note}>
          {t('opportunities.searchOnBody')}
        </Text>
        <View style={styles.platforms}>
          {EXTERNAL_PLATFORMS.map((platform) => (
            <Pressable
              key={platform}
              onPress={() => WebBrowser.openBrowserAsync(externalSearchUrl(platform, filter, getLanguage()))}
              accessibilityRole="link"
              accessibilityLabel={t('opportunities.searchOn', { platform: platformNames[platform] })}
              style={({ pressed }) => [styles.platform, pressed && { backgroundColor: colors.surfacePressed }]}>
              <Text variant="bodyStrong" style={styles.flex}>
                {t('opportunities.searchOn', { platform: platformNames[platform] })}
              </Text>
              <ArrowUpRight size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  filters: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
  },
  list: {
    gap: spacing.sm,
  },
  note: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  platforms: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  platform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  flex: {
    flex: 1,
  },
});
