import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeftRight, CircleCheck, CircleX } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { UniversityNameInput, UniversityPicker } from '@/components/university-picker';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { createEquivalence } from '@/data/api';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

function parseEcts(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function NewEquivalenceScreen() {
  const params = useLocalSearchParams<{ destinationId?: string }>();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [homeCourse, setHomeCourse] = useState('');
  const [homeEcts, setHomeEcts] = useState('');
  const [destinationId, setDestinationId] = useState<string | null>(params.destinationId ?? profile.destinationId);
  const [destinationCourse, setDestinationCourse] = useState('');
  const [destinationEcts, setDestinationEcts] = useState('');
  const [approved, setApproved] = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [saving, setSaving] = useState(false);

  const valid =
    homeUniversity.trim() && homeCourse.trim() && destinationId && destinationCourse.trim() && academicYear.trim();

  const submit = async () => {
    if (!valid || !destinationId) return;
    setSaving(true);
    try {
      await createEquivalence({
        homeUniversity: homeUniversity.trim(),
        homeCourse: homeCourse.trim(),
        homeEcts: parseEcts(homeEcts),
        destinationId,
        destinationCourse: destinationCourse.trim(),
        destinationEcts: parseEcts(destinationEcts),
        approved,
        academicYear: academicYear.trim(),
      });
      toast(t('equivalence.thanks'));
      router.back();
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('equivalence.newTitle')} modal />}
      footer={
        <Button title={t('equivalence.submit')} icon={ArrowLeftRight} onPress={submit} loading={saving} disabled={!valid} />
      }>
      <Text variant="callout" color="textSecondary">
        {t('equivalence.newBody')}
      </Text>
      <View style={styles.form}>
        <UniversityNameInput
          label={t('onboarding.homeUniversity')}
          value={homeUniversity}
          onChangeText={setHomeUniversity}
          placeholder={t('onboarding.homeUniversityPlaceholder')}
        />
        <View style={styles.courseRow}>
          <Input
            label={t('equivalence.homeCourse')}
            value={homeCourse}
            onChangeText={setHomeCourse}
            placeholder={t('equivalence.homeCoursePlaceholder')}
            containerStyle={styles.courseName}
          />
          <Input
            label={t('equivalence.ects')}
            value={homeEcts}
            onChangeText={setHomeEcts}
            keyboardType="decimal-pad"
            placeholder="6"
            containerStyle={styles.ects}
          />
        </View>
        <UniversityPicker
          label={t('onboarding.destination')}
          value={destinationId}
          onChange={setDestinationId}
          placeholder={t('onboarding.destinationPlaceholder')}
        />
        <View style={styles.courseRow}>
          <Input
            label={t('equivalence.destinationCourse')}
            value={destinationCourse}
            onChangeText={setDestinationCourse}
            placeholder={t('equivalence.destinationCoursePlaceholder')}
            containerStyle={styles.courseName}
          />
          <Input
            label={t('equivalence.ects')}
            value={destinationEcts}
            onChangeText={setDestinationEcts}
            keyboardType="decimal-pad"
            placeholder="6"
            containerStyle={styles.ects}
          />
        </View>
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('equivalence.outcome')}
          </Text>
          <ChipRow>
            <Chip label={t('equivalence.approved')} icon={CircleCheck} tone="accent" selected={approved} onPress={() => setApproved(true)} />
            <Chip label={t('equivalence.rejected')} icon={CircleX} selected={!approved} onPress={() => setApproved(false)} />
          </ChipRow>
        </View>
        <Input
          label={t('equivalence.academicYear')}
          value={academicYear}
          onChangeText={setAcademicYear}
          placeholder={t('equivalence.academicYearPlaceholder')}
        />
      </View>
    </Screen>
  );
}

export default requireAccount(NewEquivalenceScreen, 'equivalences');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  courseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  courseName: {
    flex: 1,
  },
  ects: {
    width: 84,
  },
  label: {
    marginBottom: 10,
  },
});
