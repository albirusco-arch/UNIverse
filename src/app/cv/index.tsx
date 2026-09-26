import { router } from 'expo-router';
import { ChevronRight, FileSearch, Lock, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CountryPicker } from '@/components/country-picker';
import { CvCard } from '@/components/cv-card';
import { TokenBadge, TokenCost, useFeatureCost, useNotEnoughTokens } from '@/components/tokens';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Header, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { getCv, InsufficientTokensError, listCvReviews, NoCvError, requestCvReview } from '@/data/api';
import { CAREER_TARGETS, type CareerTarget, type CvReview } from '@/data/types';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

function ReviewRow({ review }: { review: CvReview }) {
  const status =
    review.status === 'done'
      ? review.report
        ? { label: String(review.report.overallScore), tone: 'success' as const }
        : { label: t('research.statusDone'), tone: 'success' as const }
      : review.status === 'error'
        ? { label: t('research.statusError'), tone: 'red' as const }
        : { label: t('research.statusPending'), tone: 'amber' as const };
  return (
    <Card
      onPress={() => router.push({ pathname: '/cv/[id]', params: { id: review.id } })}
      accessibilityLabel={review.request.targetRole}
      style={styles.row}>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {review.request.targetRole}
        </Text>
        <Text variant="caption" color="textMuted">
          {t(`career.targets.${review.request.targetType}`)} · {formatDate(review.createdAt)}
        </Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

export default function CvScreen() {
  const { data: cv } = useQuery(getCv, []);
  const { data: reviews } = useQuery(listCvReviews, []);
  const cost = useFeatureCost('cv_review');
  const notEnoughTokens = useNotEnoughTokens();

  const [targetType, setTargetType] = useState<CareerTarget>('internship');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = Boolean(cv) && targetRole.trim().length >= 2;

  const submit = async () => {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await requestCvReview({
        targetRole: targetRole.trim(),
        targetType,
        industry: industry.trim(),
        country,
        jobDescription: jobDescription.trim(),
        notes: '',
      });
      router.push({ pathname: '/cv/[id]', params: { id } });
    } catch (err) {
      if (err instanceof InsufficientTokensError) notEnoughTokens('cv_review');
      else setError(err instanceof NoCvError ? t('cv.noCv') : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen header={<Header title={t('cv.title')} right={<TokenBadge />} />}>
      <SectionHeader title={t('cv.yourCv')} />
      <CvCard cv={cv} />
      <View style={styles.privacy}>
        <Lock size={12} color={colors.textMuted} style={styles.privacyIcon} />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {t('cv.privacy')}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('cv.target')} />
        <Card style={styles.form}>
          <ChipRow>
            {CAREER_TARGETS.map((target) => (
              <Chip
                key={target}
                label={t(`career.targets.${target}`)}
                selected={targetType === target}
                onPress={() => setTargetType(target)}
              />
            ))}
          </ChipRow>
          <Input
            label={t('cv.targetRole')}
            value={targetRole}
            onChangeText={setTargetRole}
            placeholder={t('cv.targetRolePlaceholder')}
            maxLength={120}
          />
          <Input
            label={t('cv.industry')}
            value={industry}
            onChangeText={setIndustry}
            placeholder={t('cv.industryPlaceholder')}
            maxLength={120}
          />
          <CountryPicker label={t('cv.country')} value={country} onChange={setCountry} placeholder={t('research.countryPlaceholder')} />
          <Input
            label={t('cv.jobDescription')}
            value={jobDescription}
            onChangeText={setJobDescription}
            placeholder={t('cv.jobDescriptionPlaceholder')}
            multiline
            maxLength={4000}
          />
          {error && (
            <Text variant="callout" color="red" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Button title={t('cv.submit')} icon={Sparkles} onPress={submit} loading={submitting} disabled={!valid} />
          {cost !== null && (
            <View style={styles.cost}>
              <TokenCost cost={cost} />
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('cv.history')} />
        {reviews && reviews.length > 0 ? (
          <View style={styles.list}>
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </View>
        ) : (
          <EmptyState icon={FileSearch} text={t('cv.noHistory')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  privacy: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  privacyIcon: {
    marginTop: 2,
  },
  section: {
    marginTop: spacing.xxl,
  },
  form: {
    gap: spacing.lg,
  },
  cost: {
    alignItems: 'center',
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
