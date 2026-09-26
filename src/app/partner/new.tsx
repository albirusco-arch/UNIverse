import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { UniversityPicker } from '@/components/university-picker';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { DuplicateError, getUniversity, suggestPartnership } from '@/data/api';
import { AGREEMENT_TYPES, type AgreementType } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

/** A full http(s) link to the official page that lists the agreement. */
function officialLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Students add an agreement of their home university, with the official link; it stays unverified until checked. */
function NewPartnerScreen() {
  const { profile } = useSession();
  const home = getUniversity(profile.homeUniversityId);
  const { toast } = useFeedback();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<AgreementType>('erasmus');
  const [link, setLink] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = Boolean(home && partnerId && link.trim());

  const submit = async () => {
    if (!home || !partnerId) return;
    const sourceUrl = officialLink(link);
    if (!sourceUrl) return setError(t('partners.invalidLink'));
    setError(null);
    setSaving(true);
    try {
      await suggestPartnership({
        homeUniversityId: home.id,
        partnerUniversityId: partnerId,
        agreementType: agreement,
        sourceUrl,
        academicYear: academicYear.trim(),
      });
      toast(t('partners.thanks'));
      router.back();
    } catch (err) {
      setError(err instanceof DuplicateError ? t('partners.duplicate') : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('partners.suggestTitle')} subtitle={home?.name} modal />}
      footer={<Button title={t('partners.submit')} icon={Plus} onPress={submit} loading={saving} disabled={!valid} />}>
      {home ? (
        <View style={styles.form}>
          <Text variant="callout" color="textSecondary">
            {t('partners.suggestBody', { name: home.name })}
          </Text>
          <UniversityPicker
            label={t('partners.partner')}
            value={partnerId}
            onChange={setPartnerId}
            placeholder={t('partners.partnerPlaceholder')}
            excludeId={home.id}
          />
          <View>
            <Text variant="overline" color="textMuted" style={styles.groupLabel}>
              {t('partners.agreement')}
            </Text>
            <ChipRow>
              {AGREEMENT_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(`partners.agreementTypes.${type}`)}
                  selected={agreement === type}
                  onPress={() => setAgreement(type)}
                />
              ))}
            </ChipRow>
          </View>
          <View>
            <Input
              label={t('partners.officialLink')}
              value={link}
              onChangeText={(value) => {
                setLink(value);
                setError(null);
              }}
              placeholder="https://"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={500}
            />
            <Text variant="caption" color="textMuted" style={styles.hint}>
              {t('partners.officialLinkHint')}
            </Text>
          </View>
          <Input
            label={`${t('partners.academicYear')} (${t('common.optional').toLowerCase()})`}
            value={academicYear}
            onChangeText={setAcademicYear}
            placeholder={t('rating.academicYearPlaceholder')}
            maxLength={20}
          />
          {error && (
            <Text variant="callout" color="red">
              {error}
            </Text>
          )}
        </View>
      ) : (
        <Text variant="callout" color="textSecondary">
          {t('partners.noHome')}
        </Text>
      )}
    </Screen>
  );
}

export default requireAccount(NewPartnerScreen, 'partners');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  groupLabel: {
    marginBottom: 10,
  },
  hint: {
    marginTop: spacing.xs,
  },
});
