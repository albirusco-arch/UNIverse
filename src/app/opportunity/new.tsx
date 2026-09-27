import { router } from 'expo-router';
import { Link2, Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { shareOpportunity } from '@/data/api';
import { OPPORTUNITY_KINDS, type OpportunityKind } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:/i, 'https:') : `https://${trimmed}`;
}

function NewOpportunityScreen() {
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<OpportunityKind>('internship');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [city, setCity] = useState('');
  const [remote, setRemote] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const link = normalizeUrl(url);
    if (title.trim().length < 3 || !organization.trim()) return setError(t('opportunities.missing'));
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(link)) return setError(t('opportunities.invalidUrl'));
    setSaving(true);
    try {
      await shareOpportunity({
        kind,
        title: title.trim(),
        organization: organization.trim(),
        city: city.trim(),
        remote,
        url: link,
        deadline: null,
        startsAt: null,
        universityId: profile.homeUniversityId,
        clubId: null,
        field: profile.field,
      });
      toast(t('opportunities.thanks'));
      router.back();
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const clearError = () => error && setError(null);

  return (
    <Screen
      header={<Header title={t('opportunities.shareTitle')} modal />}
      footer={<Button title={t('opportunities.submit')} icon={Send} onPress={submit} loading={saving} />}>
      <View style={styles.form}>
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('opportunities.kind')}
          </Text>
          <ChipRow>
            {OPPORTUNITY_KINDS.map((option) => (
              <Chip key={option} label={t(`opportunities.kinds.${option}`)} selected={kind === option} onPress={() => setKind(option)} />
            ))}
          </ChipRow>
        </View>
        <Input
          label={t('opportunities.titleLabel')}
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            clearError();
          }}
          placeholder={t('opportunities.titlePlaceholder')}
          maxLength={160}
        />
        <Input
          label={t('opportunities.organization')}
          value={organization}
          onChangeText={(value) => {
            setOrganization(value);
            clearError();
          }}
          maxLength={120}
        />
        <View>
          <Input label={t('opportunities.city')} value={city} onChangeText={setCity} maxLength={100} />
          <View style={styles.remote}>
            <Chip label={t('opportunities.remote')} selected={remote} onPress={() => setRemote(!remote)} />
          </View>
        </View>
        <Input
          label={t('opportunities.url')}
          hint={t('opportunities.urlHint')}
          icon={Link2}
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            clearError();
          }}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
        />
        {error && (
          <Text variant="callout" color="red">
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}

export default requireAccount(NewOpportunityScreen, 'opportunities');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  label: {
    marginBottom: 10,
  },
  remote: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
});
