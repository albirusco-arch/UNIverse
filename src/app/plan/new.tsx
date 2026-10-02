import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { planWhen } from '@/components/campus';
import { useFeedback } from '@/components/feedback';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { createPlan, getUniversity, RateLimitError } from '@/data/api';
import { t } from '@/i18n';
import { planStartOptions } from '@/lib/campus';
import { spacing } from '@/theme/tokens';

function NewPlanScreen() {
  const { campus } = useLocalSearchParams<{ campus: string }>();
  const university = getUniversity(campus);
  const { toast } = useFeedback();
  const options = useMemo(() => planStartOptions(), []);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [start, setStart] = useState(0);
  const [saving, setSaving] = useState(false);
  const valid = title.trim().length >= 3 && place.trim().length >= 2;

  const publish = async () => {
    setSaving(true);
    try {
      await createPlan({ campusId: campus, title: title.trim(), place: place.trim(), startsAt: options[start] });
      toast(t('campus.planCreated'));
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/campus/[id]', params: { id: campus } });
    } catch (error) {
      toast(error instanceof RateLimitError ? t('campus.planLimit') : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('campus.newPlan')} subtitle={university?.name} modal />}
      footer={<Button title={t('campus.publish')} onPress={publish} disabled={!valid} loading={saving} />}>
      <View style={styles.form}>
        <Input
          label={t('campus.planTitle')}
          placeholder={t('campus.planTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Input
          label={t('campus.planPlace')}
          placeholder={t('campus.planPlacePlaceholder')}
          hint={t('campus.planPlaceHint')}
          value={place}
          onChangeText={setPlace}
          maxLength={100}
        />
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('campus.planWhen')}
          </Text>
          <ChipRow>
            {options.map((date, index) => (
              <Chip
                key={date.toISOString()}
                label={planWhen(date, index === 0)}
                selected={start === index}
                onPress={() => setStart(index)}
              />
            ))}
          </ChipRow>
        </View>
        <Text variant="caption" color="textMuted">
          {t('campus.planRules', { university: university?.name ?? '' })}
        </Text>
      </View>
    </Screen>
  );
}

export default requireAccount(NewPlanScreen, 'campus');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  label: {
    marginBottom: 8,
  },
});
