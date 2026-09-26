import { router, useLocalSearchParams } from 'expo-router';
import { MessageCirclePlus, RotateCcw, SearchX, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OrbitMark } from '@/components/brand';
import { MatchReportView } from '@/components/match-report';
import { Button, Card, EmptyState, Header, Screen, Text } from '@/components/ui';
import { getCourseMatch, getUniversity, listEquivalences } from '@/data/api';
import { strings, t } from '@/i18n';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

const POLL_MS = 4000;

function Researching() {
  const steps = strings().report.steps;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % steps.length), 3500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <Card tone="violet" style={styles.researching}>
      <OrbitMark size={64} />
      <Text variant="title3" align="center">
        {t('report.researching')}
      </Text>
      <View style={styles.stepRow} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.violetLight} />
        <Text variant="callout" color="textSecondary">
          {steps[step]}
        </Text>
      </View>
      <Text variant="caption" color="textMuted" align="center">
        {t('report.researchingBody')}
      </Text>
    </Card>
  );
}

export default function MatchReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: match, loading, refresh } = useQuery(() => getCourseMatch(id), [id]);
  const pending = match?.status === 'pending' || match?.status === 'running';

  // The edge function keeps researching in the background; poll until it is done.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const destination = getUniversity(match?.request.destinationId);
  const { data: equivalences } = useQuery(
    () => listEquivalences({ destinationId: match?.request.destinationId }),
    [match?.request.destinationId],
  );

  const title = destination?.name ?? match?.request.destinationName ?? t('report.title');
  const subtitle = match ? match.request.courses.map((c) => c.name).join(' · ') : undefined;

  const runAgain = () => {
    if (!match) return;
    router.navigate({ pathname: '/match', params: { destinationId: match.request.destinationId } });
  };

  const askCommunity = () => {
    if (!match) return;
    router.push({ pathname: '/post/new', params: { universityId: match.request.destinationId, topic: 'question' } });
  };

  return (
    <Screen header={<Header title={title} subtitle={subtitle} />}>
      {!match && loading && <ActivityIndicator color={colors.violetLight} style={styles.loader} />}
      {!match && !loading && <EmptyState icon={SearchX} text={t('common.error')} />}
      {match && pending && <Researching />}
      {match?.status === 'error' && (
        <EmptyState
          icon={SearchX}
          text={t('report.failed')}
          action={<Button title={t('report.runAgain')} icon={RotateCcw} onPress={runAgain} />}
        />
      )}
      {match?.status === 'done' && match.report && (
        <>
          <MatchReportView report={match.report} equivalences={equivalences ?? []} isDemo={match.isDemo} />
          <View style={styles.actions}>
            <Button title={t('report.shareToCommunity')} variant="secondary" icon={MessageCirclePlus} onPress={askCommunity} />
            <Button title={t('report.runAgain')} variant="ghost" icon={Sparkles} onPress={runAgain} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  researching: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxxl,
    marginTop: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
});
