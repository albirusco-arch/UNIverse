import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { LogoMark } from '@/components/brand';
import { UniversityNameInput, UniversityPicker } from '@/components/university-picker';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { FIELDS, LEVELS, type Field, type Level } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { upcomingTerms } from '@/lib/terms';
import { colors, spacing } from '@/theme/tokens';

function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { signedIn, profile, updateProfile, signOut } = useSession();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [homeUniversityId, setHomeUniversityId] = useState(profile.homeUniversityId);
  const [field, setField] = useState<Field | null>(profile.field);
  const [level, setLevel] = useState<Level | null>(profile.level);
  const [destinationId, setDestinationId] = useState<string | null>(profile.destinationId);
  const [term, setTerm] = useState<string | null>(profile.term);
  const [saving, setSaving] = useState(false);

  if (!signedIn) return <Redirect href="/welcome" />;

  const terms = upcomingTerms();
  if (term && !terms.includes(term)) terms.unshift(term);
  // Linked at sign-up from the email domain (see supabase/migrations).
  const fromEmail = homeUniversityId !== null && homeUniversityId === profile.homeUniversityId;

  const finish = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        homeUniversity: homeUniversity.trim(),
        homeUniversityId,
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

  const header = editing ? (
    <Header title={t('profile.myPlan')} modal onBack={step === 2 ? () => setStep(1) : undefined} />
  ) : step === 2 ? (
    <Header subtitle={t('onboarding.step', { n: 2, total: 2 })} onBack={() => setStep(1)} />
  ) : undefined;

  if (step === 1) {
    const canContinue = displayName.trim().length > 1 && homeUniversity.trim().length > 1 && field !== null && level !== null;
    return (
      <Screen
        header={header}
        footer={<Button title={t('common.continue')} onPress={() => setStep(2)} disabled={!canContinue} />}>
        {!editing && (
          <View style={styles.top}>
            <LogoMark size={56} />
            <Text variant="overline" color="textMuted">
              {t('onboarding.step', { n: 1, total: 2 })}
            </Text>
          </View>
        )}
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
          <View>
            <UniversityNameInput
              label={t('onboarding.homeUniversity')}
              value={homeUniversity}
              onChangeText={(value, university) => {
                setHomeUniversity(value);
                setHomeUniversityId(university?.id ?? null);
              }}
              placeholder={t('onboarding.homeUniversityPlaceholder')}
            />
            {fromEmail && (
              <View style={styles.detected}>
                <BadgeCheck size={14} color={colors.success} />
                <Text variant="caption" color="success">
                  {t('onboarding.fromEmail')}
                </Text>
              </View>
            )}
          </View>
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
                <Chip key={l} tone="accent" label={t(`levels.${l}`)} selected={level === l} onPress={() => setLevel(l)} />
              ))}
            </ChipRow>
          </View>
          {!editing && (
            <Button title={t('profile.signOut')} variant="ghost" size="sm" onPress={() => signOut()} />
          )}
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
          excludeId={homeUniversityId}
        />
        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('onboarding.term')}
          </Text>
          <ChipRow>
            {terms.map((option) => (
              <Chip key={option} tone="accent" label={option} selected={term === option} onPress={() => setTerm(option)} />
            ))}
            <Chip label={t('onboarding.undecided')} selected={term === null} onPress={() => setTerm(null)} />
          </ChipRow>
        </View>
      </View>
    </Screen>
  );
}

export default requireAccount(OnboardingScreen, 'profile');

const styles = StyleSheet.create({
  top: {
    gap: spacing.md,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  lead: {
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.xl,
    marginTop: spacing.xxl,
  },
  detected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  groupLabel: {
    marginBottom: 10,
  },
});
