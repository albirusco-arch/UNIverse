import { useLocalSearchParams } from 'expo-router';
import { Award, Mail, Search, SearchX } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/segmented';
import { UniversityCard } from '@/components/university-card';
import { Button, Chip, ChipScroller, DemoBadge, EmptyState, Input, Screen, Text } from '@/components/ui';
import {
  countryList,
  getUniversity,
  getUniversityStats,
  listSavedUniversityIds,
  listScores,
  searchUniversities,
  trackSignal,
  universities,
  type Scope,
} from '@/data/api';
import { REGIONS, type Region, type University } from '@/data/types';
import { locale, t } from '@/i18n';
import { SUPPORT_EMAIL } from '@/lib/config';
import { useQuery } from '@/lib/use-query';
import { spacing } from '@/theme/tokens';

const PAGE = 40;
const REGION_FILTERS: (Region | 'all')[] = ['all', ...REGIONS];
type Sort = 'top' | 'all';

function isRegion(value: string | undefined): value is Region | 'all' {
  return REGION_FILTERS.includes(value as Region | 'all');
}

function isScope(value: string | undefined): value is Scope {
  return value === 'all' || value === 'erasmus' || value === 'overseas';
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string; region?: string; scope?: string; sort?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [region, setRegion] = useState<Region | 'all'>(isRegion(params.region) ? params.region : 'all');
  const [scope, setScope] = useState<Scope>(isScope(params.scope) ? params.scope : 'all');
  const [sort, setSort] = useState<Sort>(params.sort === 'top' ? 'top' : 'all');
  const [limit, setLimit] = useState(PAGE);

  // Other tabs can open Explore with filters set; adopt new params when they change.
  const paramKey = `${params.q ?? ''}|${params.region ?? ''}|${params.scope ?? ''}|${params.sort ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramKey);
  if (paramKey !== seenParams) {
    setSeenParams(paramKey);
    if (params.q !== undefined) setQuery(params.q);
    if (isRegion(params.region)) setRegion(params.region);
    if (isScope(params.scope)) setScope(params.scope);
    if (params.sort === 'top' || params.sort === 'all') setSort(params.sort);
  }

  const { data: stats } = useQuery(getUniversityStats, []);
  const { data: savedIds } = useQuery(listSavedUniversityIds, []);
  const { data: scores } = useQuery(listScores, []);

  let results: University[];
  let total: number;
  if (sort === 'top') {
    // Every university with a score, best first (top-rated ones are the non-provisional ≥ 75).
    const matching = new Set(searchUniversities(query, { region, scope, limit: universities.length }).map((u) => u.id));
    const ranked = Object.values(scores ?? {})
      .filter((s) => s.score !== null && matching.has(s.universityId))
      .sort((a, b) => Number(a.provisional) - Number(b.provisional) || (b.score ?? 0) - (a.score ?? 0))
      .map((s) => getUniversity(s.universityId))
      .filter((u): u is University => Boolean(u));
    total = ranked.length;
    results = ranked.slice(0, limit);
  } else {
    results = searchUniversities(query, { region, scope, limit: limit + 1 });
    total = results.length;
    results = results.slice(0, limit);
  }

  const resetPaging = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };

  const submitSearch = () => {
    if (query.trim().length >= 3) trackSignal('search', query);
  };

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <Text variant="title1" accessibilityRole="header">
          {t('explore.title')}
        </Text>
        <DemoBadge />
      </View>
      <Text variant="callout" color="textMuted" style={styles.subtitle}>
        {t('explore.subtitle', { n: universities.length.toLocaleString(locale()), countries: countryList.length })}
      </Text>

      <Input
        icon={Search}
        value={query}
        onChangeText={resetPaging(setQuery)}
        onSubmitEditing={submitSearch}
        placeholder={t('explore.searchPlaceholder')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        containerStyle={styles.search}
      />

      <Segmented<Scope>
        value={scope}
        onChange={resetPaging(setScope)}
        options={[
          { value: 'all', label: t('scopes.all') },
          { value: 'erasmus', label: t('scopes.erasmus') },
          { value: 'overseas', label: t('scopes.overseas') },
        ]}
      />

      <View style={styles.chips}>
        <ChipScroller>
          <Chip
            label={t('explore.sortTop')}
            icon={Award}
            tone="success"
            selected={sort === 'top'}
            onPress={() => resetPaging(setSort)(sort === 'top' ? 'all' : 'top')}
          />
          {REGION_FILTERS.map((r) => (
            <Chip key={r} label={t(`regions.${r}`)} selected={region === r} onPress={() => resetPaging(setRegion)(r)} />
          ))}
        </ChipScroller>
      </View>

      {results.length === 0 ? (
        <EmptyState icon={SearchX} text={t('explore.noResults')} />
      ) : (
        <View style={styles.list}>
          {results.map((university) => (
            <UniversityCard
              key={university.id}
              university={university}
              stats={stats?.[university.id]}
              score={scores?.[university.id]}
              saved={savedIds?.includes(university.id)}
            />
          ))}
          {total > results.length && (
            <Button title={t('explore.showMore')} variant="secondary" onPress={() => setLimit((n) => n + PAGE)} />
          )}
        </View>
      )}

      <Button
        title={t('explore.suggest')}
        variant="ghost"
        icon={Mail}
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=University%20suggestion`).catch(() => undefined)}
        style={styles.suggest}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    marginTop: 4,
  },
  search: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  suggest: {
    marginTop: spacing.xl,
  },
});
