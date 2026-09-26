import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Megaphone, Plus, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { UniversityPicker } from '@/components/university-picker';
import { Button, Header, Input, Screen, Text } from '@/components/ui';
import { createGroup } from '@/data/api';
import type { GroupKind, GroupVisibility } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme/tokens';

function Option({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.85 }]}>
      <Icon size={18} color={selected ? colors.primaryLight : colors.textMuted} />
      <Text variant="callout" color={selected ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <View style={[styles.radio, selected && styles.radioSelected]} />
    </Pressable>
  );
}

function NewGroupScreen() {
  const params = useLocalSearchParams<{ universityId?: string }>();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<GroupKind>('group');
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [universityId, setUniversityId] = useState<string | null>(params.universityId ?? profile.destinationId);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length >= 3;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const id = await createGroup({ name: name.trim(), description: description.trim(), kind, visibility, universityId });
      router.dismiss();
      router.push({ pathname: '/group/[id]', params: { id } });
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('groups.newTitle')} modal />}
      footer={<Button title={t('groups.createSubmit')} icon={Plus} onPress={submit} loading={saving} disabled={!valid} />}>
      <View style={styles.form}>
        <Input
          label={t('groups.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('groups.namePlaceholder')}
          maxLength={60}
          autoFocus
        />
        <Input
          label={`${t('groups.description')} (${t('common.optional').toLowerCase()})`}
          value={description}
          onChangeText={setDescription}
          placeholder={t('groups.descriptionPlaceholder')}
          multiline
          maxLength={300}
        />
        <View style={styles.options} accessibilityRole="radiogroup">
          <Text variant="overline" color="textMuted">
            {t('groups.type')}
          </Text>
          <Option icon={Users} label={t('groups.typeGroup')} selected={kind === 'group'} onPress={() => setKind('group')} />
          <Option icon={Megaphone} label={t('groups.typeChannel')} selected={kind === 'channel'} onPress={() => setKind('channel')} />
        </View>
        <View style={styles.options} accessibilityRole="radiogroup">
          <Text variant="overline" color="textMuted">
            {t('groups.visibility')}
          </Text>
          <Option
            icon={Users}
            label={t('groups.visibilityPublic')}
            selected={visibility === 'public'}
            onPress={() => setVisibility('public')}
          />
          <Option
            icon={Lock}
            label={t('groups.visibilityPrivate')}
            selected={visibility === 'private'}
            onPress={() => setVisibility('private')}
          />
        </View>
        <UniversityPicker
          label={`${t('groups.university')} (${t('common.optional').toLowerCase()})`}
          value={universityId}
          onChange={setUniversityId}
          placeholder={t('onboarding.destinationPlaceholder')}
        />
      </View>
    </Screen>
  );
}

export default requireAccount(NewGroupScreen, 'groups');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  radioSelected: {
    borderColor: colors.primaryLight,
    borderWidth: 5,
  },
});
