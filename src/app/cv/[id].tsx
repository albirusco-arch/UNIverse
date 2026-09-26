import { useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { CvReportView } from '@/components/cv-report';
import { JobProgress } from '@/components/job-progress';
import { EmptyState, Header, Screen } from '@/components/ui';
import { getCvReview } from '@/data/api';
import { t } from '@/i18n';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

const POLL_MS = 4000;

export default function CvReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: review, loading, refresh } = useQuery(() => getCvReview(id), [id]);
  const pending = review?.status === 'pending' || review?.status === 'running';

  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [pending, refresh]);

  const subtitle = review ? `${t(`career.targets.${review.request.targetType}`)} · ${review.request.targetRole}` : undefined;

  return (
    <Screen header={<Header title={t('cv.title')} subtitle={subtitle} />}>
      {!review && loading && <ActivityIndicator color={colors.primaryLight} style={styles.loader} />}
      {!review && !loading && <EmptyState icon={SearchX} text={t('common.error')} />}
      {review && pending && <JobProgress title={t('cv.reviewing')} body={t('cv.reviewingBody')} />}
      {review?.status === 'error' && <EmptyState icon={SearchX} text={t('cv.failed')} />}
      {review?.status === 'done' && review.report && <CvReportView report={review.report} isDemo={review.isDemo} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
});
