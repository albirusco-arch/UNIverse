import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Sparkles, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrbitMark } from '@/components/brand';
import { GradientText } from '@/components/gradient-text';
import { UniversityNameInput, UniversityPicker } from '@/components/university-picker';
import { Button, Chip, ChipRow, Header, IconTile, Input, Screen, Text } from '@/components/ui';
import { FIELDS, LEVELS, type Field, type Level } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { upcomingTerms } from '@/lib/terms';
import { gradients, spacing, type } from '@/theme/tokens';

const features: { icon: LucideIcon; colors: readonly [string, string]; title: () => string; body: () => string }[] = [
  { icon: Sparkles, colors: gradients.violet, title: () => t('onboarding.feature1Title'), body: () => t('onboarding.feature1Body') },
  { icon: Users, colors: gradients.teal, title: () => t('onboarding.feature2Title'), body: () => t('onboarding.feature2Body') },
  { icon: BadgeCheck, colors: gradients.indigo, title: () => t('onboarding.feature3Title'), body: () => t('onboarding.feature3Body') },
];

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { profile, updateProfile } = useSession();

  const [step, setStep] = useState(editing ? 1 : 0);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [field, setField] = useState<Field | null>(profile.field);
  const [level, setLevel] = useState<Level | null>(profile.level);
  const [destinationId, setDestinationId] = useState<string | null>(profile.destinationId);
  const [term, setTerm] = useState<string | null>(profile.term);
  const [saving, setSaving] = useState(false);

  const terms = upcomingTerms();
  if (term && !terms.includes(term)) terms.unshift(term);

  const finish = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        homeUniversity: homeUniversity.trim(),
        field,
        level,
        destinationId,
        term,
      });
      if (editing && router.canGoBack()) router.back();
      else router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  if (step === 0) {
    return (
      <Screen footer={<Button title={t('onboarding.getStarted')} onPress={() => setStep(1)} />}>
        <View style={styles.welcome}>
          <OrbitMark size={72} />
          <View>
            <Text variant="display">{t('onboarding.welcomeTitle')}</Text>
            <GradientText text={t('onboarding.welcomeAccent')} style={type.display} />
          </View>
          <Text variant="body" color="textSecondary">
            {t('onboarding.welcomeBody')}
          </Text>
          <View style={styles.features}>
            {features.map((feature) => (
              <View key={feature.title()} style={styles.feature}>
                <IconTile icon={feature.icon} colors={feature.colors} size={44} />
                <View style={styles.featureText}>
                  <Text variant="bodyStrong">{feature.title()}</Text>
                  <Text variant="callout" color="textMuted">
                    {feature.body()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  const header = (
    <Header
      title={editing ? t('profile.myPlan') : undefined}
      subtitle={editing ? undefined : t('onboarding.step', { n: step, total: 2 })}
      modal={editing}
      onBack={editing ? undefined : () => setStep(step - 1)}
    />
  );

  if (step === 1) {
    const canContinue = homeUniversity.trim().length > 1 && field !== null && level !== null;
    return (
      <Screen
        header={header}
        footer={<Button title={t('common.continue')} onPress={() => setStep(2)} disabled={!canContinue} />}>
        <Text variant="title1">{t('onboarding.aboutTitle')}</Text>
        <Text variant="body" color="textSecondary" style={styles.lead}>
          {t('onboarding.aboutBody')}
        </Text>
        <View style={styles.form}>
          <Input
            label={t('onboarding.name')}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('onboarding.namePlaceholder')}
            autoComplete="name"
            textContentType="name"
          />
          <UniversityNameInput
            label={t('onboarding.homeUniversity')}
            value={homeUniversity}
            onChangeText={setHomeUniversity}
            placeholder={t('onboarding.homeUniversityPlaceholder')}
          />
          <View>
            <Text variant="overline" color="textMuted" style={styles.groupLabel}>
              {t('onboarding.fieldOfStudy')}
            </Text>
            <ChipRow>
              {FIELDS.map((f) => (
                <Chip key={f} label={t(`fields.${f}`)} selected={field === f} onPress={() => setField(f)} />
              ))}
            </ChipRow>
          </View>
          <View>
            <Text variant="overline" color="textMuted" style={styles.groupLabel}>
              {t('onboarding.level')}
            </Text>
            <ChipRow>
              {LEVELS.map((l) => (
                <Chip key={l} tone="teal" label={t(`levels.${l}`)} selected={level === l} onPress={() => setLevel(l)} />
              ))}
            </ChipRow>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          title={editing ? t('onboarding.saveChanges') : t('onboarding.finish')}
          onPress={finish}
          loading={saving}
        />
      }>
      <Text variant="title1">{t('onboarding.exchangeTitle')}</Text>
      <Text variant="body" color="textSecondary" style={styles.lead}>
        {t('onboarding.exchangeBody')}
      </Text>
      <View style={styles.form}>
        <UniversityPicker
          label={t('onboarding.destination')}
          value={destinationId}
          onChange={setDestinationId}
          placeholder={t('onboarding.destinationPlaceholder')}
        />
        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('onboarding.term')}
          </Text>
          <ChipRow>
            {terms.map((option) => (
              <Chip key={option} tone="teal" label={option} selected={term === option} onPress={() => setTerm(option)} />
            ))}
            <Chip label={t('onboarding.undecided')} selected={term === null} onPress={() => setTerm(null)} />
          </ChipRow>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: {
    gap: spacing.xl,
    paddingTop: spacing.xxl,
  },
  features: {
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  lead: {
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.xl,
    marginTop: spacing.xxl,
  },
  groupLabel: {
    marginBottom: 10,
  },
});
