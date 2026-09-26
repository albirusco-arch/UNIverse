import { router } from 'expo-router';
import { Info, Leaf, RefreshCw, SearchX, Sparkles, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useRequireAccount } from '@/components/account-gate';
import { SourceChips, SourceList, VerificationBadge } from '@/components/research-report';
import { ScoreBar, ScoreRing, Stars, tierColors, TopRatedBadge } from '@/components/score';
import { Badge, Button, Card, SectionHeader, Text } from '@/components/ui';
import { getInsights, getMyRating, getRatingSummary, listScores, RateLimitError, requestInsights } from '@/data/api';
import { RATING_DIMENSIONS, type InsightPillarName, type University } from '@/data/types';
import { t } from '@/i18n';
import { formatDate, isOlderThan } from '@/lib/format';
import { scoreTier } from '@/lib/scores';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

const PILLARS: InsightPillarName[] = ['environmental', 'social', 'governance', 'teaching'];
const REFRESH_AFTER_DAYS = 30;

/**
 * The "Quality" tab of a university: the UNIverse score, student ratings and the
 * ESG / teaching evidence researched by AI (only verified evidence is scored).
 */
export function QualityPanel({ university }: { university: University }) {
  const id = university.id;
  const { data: scores } = useQuery(listScores, []);
  const { data: summary } = useQuery(() => getRatingSummary(id), [id]);
  const { data: insights, refresh } = useQuery(() => getInsights(id), [id]);
  const { data: myRating } = useQuery(() => getMyRating(id), [id]);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requireAccount = useRequireAccount();

  const score = scores?.[id];
  const running = insights?.status === 'pending' || insights?.status === 'running';
  const stale = insights?.checkedAt ? isOlderThan(insights.checkedAt, REFRESH_AFTER_DAYS) : false;

  const research = () =>
    requireAccount('research', async () => {
      setError(null);
      setRequesting(true);
      try {
        await requestInsights(id);
        refresh();
      } catch (err) {
        setError(err instanceof RateLimitError ? t('common.limit') : t('common.error'));
      } finally {
        setRequesting(false);
      }
    });

  const rate = () => requireAccount('rate', () => router.push({ pathname: '/rate/[id]', params: { id } }));

  return (
    <View style={styles.stack}>
      <Card style={styles.scoreCard}>
        <View style={styles.scoreTop}>
          <ScoreRing score={score?.score ?? null} />
          <View style={styles.flex}>
            <Text variant="overline" color="textMuted">
              {t('score.title')}
            </Text>
            {score?.score != null ? (
              <Text variant="title2" style={{ color: tierColors[scoreTier(score.score)] }}>
                {t(`score.tiers.${scoreTier(score.score)}`)}
              </Text>
            ) : (
              <Text variant="title3" color="textSecondary">
                {t('score.none')}
              </Text>
            )}
            <Text variant="caption" color="textMuted">
              {t('score.ratings', { n: summary?.count ?? 0 })}
            </Text>
            <View style={styles.badgeRow}>
              <TopRatedBadge score={score} />
            </View>
          </View>
        </View>
        <View style={styles.bars}>
          <ScoreBar label={t('score.esg')} weight="35%" value={score?.esgScore ?? insights?.esgScore ?? null} />
          <ScoreBar label={t('score.teaching')} weight="25%" value={score?.teachingScore ?? insights?.teachingScore ?? null} />
          <ScoreBar label={t('score.students')} weight="40%" value={score?.studentScore ?? null} />
        </View>
        {(score?.provisional ?? true) && (
          <View style={styles.note}>
            <Info size={14} color={colors.amber} style={styles.noteIcon} />
            <Text variant="caption" color="amber" style={styles.flex}>
              {t('score.provisional')}
            </Text>
          </View>
        )}
        <Text variant="caption" color="textMuted">
          {t('score.method')}
        </Text>
      </Card>

      <View>
        <SectionHeader title={t('quality.studentRatings')} />
        <Card style={styles.ratings}>
          {RATING_DIMENSIONS.map((dimension) => {
            const value = summary?.[dimension] ?? null;
            return (
              <View key={dimension} style={styles.ratingRow}>
                <Text variant="callout" color="textSecondary" style={styles.flex}>
                  {t(`quality.dimensions.${dimension}`)}
                </Text>
                <Stars value={value} />
                <Text variant="caption" style={styles.ratingValue}>
                  {value === null ? '–' : value.toFixed(1)}
                </Text>
              </View>
            );
          })}
          <Button
            title={myRating ? t('quality.updateRating') : t('quality.rate')}
            icon={Star}
            variant={myRating ? 'secondary' : 'primary'}
            onPress={rate}
          />
          <Text variant="caption" color="textMuted">
            {t('rating.body')}
          </Text>
        </Card>
      </View>

      <View>
        <SectionHeader title={t('quality.summary')} />
        {!insights && (
          <Card style={styles.emptyCard}>
            <Leaf size={22} color={colors.successLight} />
            <Text variant="callout" color="textSecondary" align="center">
              {t('quality.notResearched')}
            </Text>
            <Button title={t('quality.research')} icon={Sparkles} onPress={research} loading={requesting} />
          </Card>
        )}
        {running && (
          <Card tone="primary" style={styles.emptyCard}>
            <ActivityIndicator color={colors.primaryLight} />
            <Text variant="bodyStrong" align="center">
              {t('quality.researching')}
            </Text>
            <Text variant="caption" color="textMuted" align="center">
              {t('quality.researchingBody')}
            </Text>
          </Card>
        )}
        {insights?.status === 'error' && (
          <Card style={styles.emptyCard}>
            <SearchX size={22} color={colors.textMuted} />
            <Text variant="callout" color="textSecondary" align="center">
              {t('quality.failed')}
            </Text>
            <Button title={t('common.retry')} icon={RefreshCw} variant="secondary" onPress={research} loading={requesting} />
          </Card>
        )}
        {insights?.status === 'done' && (
          <View style={styles.stack}>
            {insights.isDemo && (
              <Card tone="amber" style={styles.inline}>
                <Info size={16} color={colors.amber} />
                <Text variant="caption" style={styles.flex}>
                  {t('quality.demoBanner')}
                </Text>
              </Card>
            )}
            <Text variant="body" color="textSecondary">
              {insights.summary}
            </Text>
            {insights.checkedAt && (
              <Text variant="caption" color="textMuted">
                {t('quality.checkedOn', { date: formatDate(insights.checkedAt) })}
              </Text>
            )}
            {PILLARS.map((pillar) => {
              const indicators = insights.indicators.filter((i) => i.pillar === pillar);
              const pillarScore = pillar === 'teaching' ? insights.teachingScore : null;
              return (
                <Card key={pillar} style={styles.pillar}>
                  <View style={styles.inlineBetween}>
                    <Text variant="overline" color="primaryPale">
                      {t(`quality.${pillar}`)}
                    </Text>
                    {pillarScore !== null && <Badge label={`${pillarScore}/100`} tone="primary" />}
                  </View>
                  {indicators.length === 0 ? (
                    <Text variant="caption" color="textMuted">
                      {t('quality.noEvidence')}
                    </Text>
                  ) : (
                    indicators.map((indicator, index) => (
                      <View key={`${indicator.label}-${index}`} style={[styles.indicator, index > 0 && styles.separator]}>
                        <View style={styles.inlineBetween}>
                          <Text variant="bodyStrong" style={styles.flex}>
                            {indicator.label}
                          </Text>
                          <VerificationBadge item={indicator} />
                        </View>
                        <Text variant="callout" color="textSecondary">
                          {indicator.value}
                        </Text>
                        <SourceChips ids={indicator.sourceIds} sources={insights.sources} />
                      </View>
                    ))
                  )}
                </Card>
              );
            })}
            {insights.sources.length > 0 && <SourceList sources={insights.sources} />}
            {stale && (
              <Button title={t('quality.research')} icon={RefreshCw} variant="ghost" onPress={research} loading={requesting} />
            )}
          </View>
        )}
        {error && (
          <Text variant="callout" color="red" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  scoreCard: {
    gap: spacing.lg,
  },
  scoreTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  bars: {
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  noteIcon: {
    marginTop: 1,
  },
  ratings: {
    gap: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingValue: {
    width: 28,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.text,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pillar: {
    gap: spacing.sm,
  },
  indicator: {
    gap: 4,
    paddingTop: spacing.xs,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  error: {
    marginTop: spacing.md,
  },
});
