import { useLocalSearchParams } from 'expo-router';
import { Mail, Search, SearchX } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { UniversityCard } from '@/components/university-card';
import { Button, Chip, ChipScroller, EmptyState, Input, Screen, Text } from '@/components/ui';
import { getUniversityStats, listSavedUniversityIds, searchUniversities } from '@/data/api';
import type { Region } from '@/data/types';
import { t } from '@/i18n';
import { SUPPORT_EMAIL } from '@/lib/config';
import { useQuery } from '@/lib/use-query';
import { spacing } from '@/theme/tokens';

const REGIONS: (Region | 'all')[] = ['all', 'europe', 'uk', 'north_america', 'asia', 'oceania'];

function isRegion(value: string | undefined): value is Region | 'all' {
  return REGIONS.includes(value as Region | 'all');
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string; region?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [region, setRegion] = useState<Region | 'all'>(isRegion(params.region) ? params.region : 'all');

  // Home can open this tab with a search already filled in; adopt new params when they change.
  const paramKey = `${params.q ?? ''}|${params.region ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    if (params.q !== undefined) setQuery(params.q);
    if (isRegion(params.region)) setRegion(params.region);
  }

  const { data: stats } = useQuery(getUniversityStats, []);
  const { data: savedIds } = useQuery(listSavedUniversityIds, []);
  const results = searchUniversities(query, region);

  return (
    <Screen tab>
      <Text variant="title1" accessibilityRole="header">
        {t('explore.title')}
      </Text>
      <Text variant="callout" color="textMuted" style={styles.subtitle}>
        {t('explore.subtitle')}
      </Text>

      <Input
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('explore.searchPlaceholder')}
        returnKeyType="search"
        autoCorrect={false}
        containerStyle={styles.search}
      />
      <ChipScroller>
        {REGIONS.map((r) => (
          <Chip key={r} label={t(`regions.${r}`)} selected={region === r} onPress={() => setRegion(r)} />
        ))}
      </ChipScroller>

      <Text variant="caption" color="textMuted" style={styles.count}>
        {t('explore.results', { n: results.length })}
      </Text>

      {results.length === 0 ? (
        <EmptyState icon={SearchX} text={t('explore.noResults')} />
      ) : (
        <View style={styles.list}>
          {results.map((university) => (
            <UniversityCard
              key={university.id}
              university={university}
              stats={stats?.[university.id]}
              saved={savedIds?.includes(university.id)}
            />
          ))}
        </View>
      )}

      <Button
        title={t('explore.suggest')}
        variant="ghost"
        icon={Mail}
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=University%20suggestion`)}
        style={styles.suggest}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 4,
  },
  search: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  count: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  suggest: {
    marginTop: spacing.xl,
  },
});
