import { router, useLocalSearchParams } from 'expo-router';
import { MessageCirclePlus, RotateCcw, SearchX, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { LogoMark } from '@/components/brand';
import { ResearchReportView } from '@/components/research-report';
import { Button, Card, EmptyState, Header, Screen, Text } from '@/components/ui';
import { countryName, getResearch, getUniversity, listEquivalences } from '@/data/api';
import type { Research } from '@/data/types';
import { strings, t } from '@/i18n';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

const POLL_MS = 4000;

function Researching() {
  const steps = strings().report.progress;
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % steps.length), 3500);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <Card tone="primary" style={styles.researching}>
      <LogoMark size={96} />
      <Text variant="title3" align="center">
        {t('report.researching')}
      </Text>
      <View style={styles.stepRow} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primaryLight} />
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

/** Header subtitle: what was researched, in a few words. */
function describe(research: Research): string {
  const { request } = research;
  switch (research.kind) {
    case 'exchange':
      return request.courses.map((c) => c.name).join(' · ');
    case 'admission':
      return request.program;
    case 'scholarships':
      return [request.program, request.term].filter(Boolean).join(' · ');
    case 'visa':
      return `${countryName(request.citizenship)} → ${countryName(request.destinationCountry)}`;
  }
}

function ResearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: research, loading, refresh } = useQuery(() => getResearch(id), [id]);
  const pending = research?.status === 'pending' || research?.status === 'running';

  // The edge function keeps researching in the background; poll until it is done.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const destinationId = research?.request.destinationId ?? null;
  const destination = getUniversity(destinationId);
  const { data: equivalences } = useQuery(
    () => (research?.kind === 'exchange' && destinationId ? listEquivalences({ destinationId }) : Promise.resolve([])),
    [research?.kind, destinationId],
  );

  const title = research
    ? (destination?.name ?? (research.request.destinationName || countryName(research.request.destinationCountry)))
    : t('research.title');
  const subtitle = research ? `${t(`research.kinds.${research.kind}`)} · ${describe(research)}` : undefined;

  const runAgain = () => {
    if (!research) return;
    router.navigate({ pathname: '/research', params: { kind: research.kind, destinationId: destinationId ?? undefined } });
  };

  const askCommunity = () => {
    if (!research) return;
    router.push({ pathname: '/post/new', params: { universityId: destinationId ?? undefined, topic: 'question' } });
  };

  return (
    <Screen header={<Header title={title} subtitle={subtitle} />}>
      {!research && loading && <ActivityIndicator color={colors.primaryLight} style={styles.loader} />}
      {!research && !loading && <EmptyState icon={SearchX} text={t('common.error')} />}
      {research && pending && <Researching />}
      {research?.status === 'error' && (
        <EmptyState
          icon={SearchX}
          text={t('report.failed')}
          action={<Button title={t('report.runAgain')} icon={RotateCcw} onPress={runAgain} />}
        />
      )}
      {research?.status === 'done' && research.report && (
        <>
          <ResearchReportView
            kind={research.kind}
            report={research.report}
            equivalences={equivalences ?? []}
            isDemo={research.isDemo}
          />
          <View style={styles.actions}>
            <Button title={t('report.askCommunity')} variant="secondary" icon={MessageCirclePlus} onPress={askCommunity} />
            <Button title={t('report.runAgain')} variant="ghost" icon={Sparkles} onPress={runAgain} />
          </View>
        </>
      )}
    </Screen>
  );
}

export default requireAccount(ResearchScreen, 'research');

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
