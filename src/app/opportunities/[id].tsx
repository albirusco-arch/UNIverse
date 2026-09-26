import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Building2, ExternalLink, Info, Lightbulb, SearchX } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { JobProgress } from '@/components/job-progress';
import { OpportunityCard } from '@/components/opportunity-card';
import { SourceList } from '@/components/research-report';
import { Badge, Card, EmptyState, Header, Screen, SectionHeader, Text } from '@/components/ui';
import { getOpportunitySearch, listSavedOpportunities, setOpportunitySaved } from '@/data/api';
import { t } from '@/i18n';
import { formatDate, hostname } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

const POLL_MS = 4000;

export default function OpportunityResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: search, loading, refresh } = useQuery(() => getOpportunitySearch(id), [id]);
  const { data: saved } = useQuery(listSavedOpportunities, []);
  const pending = search?.status === 'pending' || search?.status === 'running';

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const savedUrls = new Set((saved ?? []).map((item) => item.url));
  const report = search?.report;

  return (
    <Screen header={<Header title={t('opportunities.title')} subtitle={search?.request.keywords} />}>
      {!search && loading && <ActivityIndicator color={colors.primaryLight} style={styles.loader} />}
      {!search && !loading && <EmptyState icon={SearchX} text={t('common.error')} />}
      {search && pending && <JobProgress title={t('opportunities.searching')} body={t('opportunities.searchingBody')} />}
      {search?.status === 'error' && <EmptyState icon={SearchX} text={t('opportunities.failed')} />}
      {search?.status === 'done' && report && (
        <View style={styles.container}>
          {search.isDemo && (
            <Card tone="amber" style={styles.inline}>
              <Info size={18} color={colors.amber} />
              <Text variant="callout" style={styles.flex}>
                {t('opportunities.demoBanner')}
              </Text>
            </Card>
          )}

          <View>
            <Text variant="body" color="textSecondary">
              {report.summary}
            </Text>
            <Text variant="caption" color="textMuted" style={styles.checked}>
              {t('report.checkedOn', { date: formatDate(report.checkedAt) })}
            </Text>
          </View>

          <View>
            <SectionHeader title={t('opportunities.results')} />
            {report.opportunities.length > 0 ? (
              <View style={styles.list}>
                {report.opportunities.map((opportunity) => {
                  const isSaved = savedUrls.has(opportunity.url);
                  return (
                    <OpportunityCard
                      key={opportunity.url}
                      opportunity={opportunity}
                      sources={report.sources}
                      saved={isSaved}
                      onToggleSave={() => setOpportunitySaved(opportunity, !isSaved).catch(() => undefined)}
                    />
                  );
                })}
              </View>
            ) : (
              <EmptyState icon={SearchX} text={t('opportunities.noResults')} />
            )}
          </View>

          {report.organizations.length > 0 && (
            <View>
              <SectionHeader title={t('opportunities.organizations')} />
              <View style={styles.list}>
                {report.organizations.map((org) => (
                  <Card key={org.name} style={styles.item}>
                    <View style={styles.inline}>
                      <Building2 size={16} color={colors.accentLight} />
                      <Text variant="bodyStrong" style={styles.flex}>
                        {org.name}
                      </Text>
                      {org.verified && <Badge label={t('report.verified')} tone="success" />}
                    </View>
                    <Text variant="callout" color="textSecondary">
                      {org.why}
                    </Text>
                    {org.careersUrl ? (
                      <Pressable
                        onPress={() => WebBrowser.openBrowserAsync(org.careersUrl).catch(() => undefined)}
                        accessibilityRole="link"
                        style={styles.inline}>
                        <ExternalLink size={14} color={colors.primaryLight} />
                        <Text variant="callout" color="primaryLight">
                          {t('opportunities.careers')} · {hostname(org.careersUrl)}
                        </Text>
                      </Pressable>
                    ) : null}
                  </Card>
                ))}
              </View>
            </View>
          )}

          {report.tips.length > 0 && (
            <View>
              <SectionHeader title={t('opportunities.tips')} />
              <Card tone="primary" style={styles.item}>
                {report.tips.map((tip, index) => (
                  <View key={index} style={styles.inlineTop}>
                    <Lightbulb size={16} color={colors.primaryLight} style={styles.icon} />
                    <Text variant="callout" style={styles.flex}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {report.sources.length > 0 && <SourceList sources={report.sources} />}

          <Card style={styles.inlineTop}>
            <Info size={16} color={colors.textMuted} style={styles.icon} />
            <Text variant="caption" color="textSecondary" style={styles.flex}>
              {t('opportunities.disclaimer')}
            </Text>
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  container: {
    gap: spacing.xxl,
  },
  flex: {
    flex: 1,
  },
  checked: {
    marginTop: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
  item: {
    gap: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  icon: {
    marginTop: 2,
  },
});
