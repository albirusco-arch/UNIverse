import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Header, Input, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { normalizeProfileLink } from '@/lib/job-links';
import { useSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme/tokens';

type Kind = 'linkedin' | 'handshake' | 'jobteaser';

export default function CareerLinksScreen() {
  const { profile, updateProfile } = useSession();
  const { toast } = useFeedback();
  const [values, setValues] = useState<Record<Kind, string>>({
    linkedin: profile.linkedinUrl,
    handshake: profile.handshakeUrl,
    jobteaser: profile.jobteaserUrl,
  });
  const [open, setOpen] = useState(profile.openToOpportunities);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const normalized = {} as Record<Kind, string>;
    for (const kind of ['linkedin', 'handshake', 'jobteaser'] as const) {
      const link = normalizeProfileLink(kind, values[kind]);
      if (link === null) return setError(t('links.invalid', { name: t(`career.platforms.${kind}`) }));
      normalized[kind] = link;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({
        linkedinUrl: normalized.linkedin,
        handshakeUrl: normalized.handshake,
        jobteaserUrl: normalized.jobteaser,
        openToOpportunities: open,
      });
      toast(t('links.saved'));
      router.back();
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const field = (kind: Kind) => (
    <Input
      label={t(`links.${kind}`)}
      value={values[kind]}
      onChangeText={(value) => setValues((current) => ({ ...current, [kind]: value }))}
      placeholder={t(`links.${kind}Placeholder`)}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
    />
  );

  return (
    <Screen
      header={<Header title={t('links.title')} modal />}
      footer={<Button title={t('links.save')} onPress={save} loading={saving} />}>
      <Text variant="callout" color="textSecondary">
        {t('career.connectionsBody')}
      </Text>
      <View style={styles.form}>
        {field('linkedin')}
        {field('handshake')}
        {field('jobteaser')}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: open }}
          style={[styles.toggle, open && styles.toggleOn]}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('links.open')}</Text>
            <Text variant="caption" color="textMuted">
              {t('links.openBody')}
            </Text>
          </View>
          <View style={[styles.check, open && styles.checkOn]}>{open && <Check size={14} color="#FFFFFF" strokeWidth={3} />}</View>
        </Pressable>
        {error && (
          <Text variant="callout" color="red" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <Text variant="caption" color="textMuted">
          {t('links.visibility')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  form: {
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleOn: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successSoft,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
});
