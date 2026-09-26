import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { getUniversity, suggestClub } from '@/data/api';
import { CLUB_CATEGORIES, type ClubCategory } from '@/data/types';
import { t } from '@/i18n';
import { spacing } from '@/theme/tokens';

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function NewClubScreen() {
  const { universityId } = useLocalSearchParams<{ universityId: string }>();
  const university = getUniversity(universityId);
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ClubCategory>('international');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length >= 2 && Boolean(university);

  const submit = async () => {
    if (!valid || !university) return;
    setSaving(true);
    try {
      await suggestClub({
        universityId: university.id,
        name: name.trim(),
        category,
        description: description.trim(),
        website: normalizeUrl(website),
        instagram: instagram.trim(),
      });
      toast(t('clubs.thanks'));
      router.back();
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('clubs.newTitle')} subtitle={university?.name} modal />}
      footer={<Button title={t('clubs.submit')} icon={Plus} onPress={submit} loading={saving} disabled={!valid} />}>
      <View style={styles.form}>
        <Input label={t('clubs.name')} value={name} onChangeText={setName} maxLength={100} autoFocus />
        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('clubs.category')}
          </Text>
          <ChipRow>
            {CLUB_CATEGORIES.map((c) => (
              <Chip key={c} label={t(`clubs.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ChipRow>
        </View>
        <Input
          label={`${t('clubs.description')} (${t('common.optional').toLowerCase()})`}
          value={description}
          onChangeText={setDescription}
          placeholder={t('clubs.descriptionPlaceholder')}
          multiline
          maxLength={300}
        />
        <Input
          label={`${t('clubs.website')} (${t('common.optional').toLowerCase()})`}
          value={website}
          onChangeText={setWebsite}
          placeholder={t('clubs.websitePlaceholder')}
          keyboardType="url"
          autoCapitalize="none"
          maxLength={300}
        />
        <Input
          label={`${t('clubs.instagram')} (${t('common.optional').toLowerCase()})`}
          value={instagram}
          onChangeText={setInstagram}
          placeholder={t('clubs.instagramPlaceholder')}
          autoCapitalize="none"
          maxLength={100}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  groupLabel: {
    marginBottom: 10,
  },
});
