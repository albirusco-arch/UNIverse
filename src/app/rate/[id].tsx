import { router, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { StarInput } from '@/components/score';
import { Button, Card, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { getMyRating, getUniversity, rateUniversity } from '@/data/api';
import { RATING_DIMENSIONS, type RatingDimension, type StudentRelation, type UniversityRating } from '@/data/types';
import { t } from '@/i18n';
import { useQuery } from '@/lib/use-query';
import { spacing } from '@/theme/tokens';

const RELATIONS: StudentRelation[] = ['exchange', 'degree', 'researcher'];
const ACADEMIC_YEAR = /^\d{4}(\/(\d{2}|\d{4}))?$/;

function RatingForm({ universityId, initial }: { universityId: string; initial: UniversityRating | null }) {
  const { toast } = useFeedback();
  const [values, setValues] = useState<Record<RatingDimension, number>>({
    teaching: initial?.teaching ?? 0,
    professors: initial?.professors ?? 0,
    environment: initial?.environment ?? 0,
    sustainability: initial?.sustainability ?? 0,
  });
  const [relation, setRelation] = useState<StudentRelation>(initial?.relation ?? 'exchange');
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? '');
  const [saving, setSaving] = useState(false);

  const valid = RATING_DIMENSIONS.every((d) => values[d] >= 1) && ACADEMIC_YEAR.test(academicYear.trim());

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await rateUniversity(universityId, { ...values, relation, academicYear: academicYear.trim() });
      toast(t('rating.thanks'));
      router.back();
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card style={styles.stars}>
        {RATING_DIMENSIONS.map((dimension) => (
          <StarInput
            key={dimension}
            label={t(`quality.dimensions.${dimension}`)}
            value={values[dimension]}
            onChange={(n) => setValues((current) => ({ ...current, [dimension]: n }))}
          />
        ))}
      </Card>
      <View style={styles.form}>
        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('rating.relation')}
          </Text>
          <ChipRow>
            {RELATIONS.map((r) => (
              <Chip key={r} label={t(`rating.relations.${r}`)} selected={relation === r} onPress={() => setRelation(r)} />
            ))}
          </ChipRow>
        </View>
        <Input
          label={t('rating.academicYear')}
          value={academicYear}
          onChangeText={setAcademicYear}
          placeholder={t('rating.academicYearPlaceholder')}
          maxLength={7}
          keyboardType="numbers-and-punctuation"
        />
        <Button title={t('rating.submit')} icon={Star} onPress={submit} loading={saving} disabled={!valid} />
      </View>
    </>
  );
}

function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const university = getUniversity(id);
  const { data: existing, loading } = useQuery(() => getMyRating(id), [id]);

  return (
    <Screen header={<Header title={t('rating.title', { name: university?.name ?? '' })} modal />}>
      <Text variant="callout" color="textSecondary" style={styles.body}>
        {t('rating.body')}
      </Text>
      {/* Mount the form once the previous rating (if any) is known, so it starts pre-filled. */}
      {!loading && <RatingForm key={existing ? 'update' : 'new'} universityId={id} initial={existing ?? null} />}
    </Screen>
  );
}

export default requireAccount(RateScreen, 'rate');

const styles = StyleSheet.create({
  body: {
    marginBottom: spacing.xl,
  },
  stars: {
    gap: spacing.lg,
  },
  form: {
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  groupLabel: {
    marginBottom: 10,
  },
});
