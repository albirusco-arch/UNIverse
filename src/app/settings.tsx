import { router } from 'expo-router';
import { FileText, Languages, LifeBuoy, LogIn, Mail, Route, Scale, ShieldCheck, Trash2, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Card, Divider, Header, ListRow, Screen, Text } from '@/components/ui';
import { deleteAccount } from '@/data/api';
import { LANGUAGES, t, type LanguagePreference } from '@/i18n';
import { APP_VERSION, SUPPORT_EMAIL } from '@/lib/config';
import { useLanguage } from '@/lib/language';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/theme/tokens';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="overline" color="textMuted" style={styles.groupTitle}>
        {title}
      </Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const { signedIn, email, signOut } = useSession();
  const { showSheet, toast } = useFeedback();
  const [deleting, setDeleting] = useState(false);
  const { language, preference, setPreference } = useLanguage();

  const languageLabel = (value: LanguagePreference) =>
    value === 'system' ? t('settings.languageSystem') : t(`languages.${value}`);

  const chooseLanguage = () =>
    showSheet({
      title: t('settings.language'),
      options: (['system', ...LANGUAGES] as const).map((value) => ({
        label: value === preference ? `${languageLabel(value)} ✓` : languageLabel(value),
        onPress: () => setPreference(value),
      })),
    });

  const confirmDelete = () =>
    showSheet({
      title: t('settings.deleteTitle'),
      message: t('settings.deleteBody'),
      options: [
        {
          label: t('settings.deleteAccount'),
          destructive: true,
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await signOut();
              toast(t('settings.deleted'));
              router.replace('/welcome');
            } catch {
              toast(t('common.error'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });

  return (
    <Screen header={<Header title={t('settings.title')} />}>
      {signedIn ? (
        <Group title={t('settings.account')}>
          <ListRow icon={Mail} label={t('settings.email')} value={email ?? ''} />
          <Divider />
          <ListRow icon={Route} label={t('settings.plan')} onPress={() => router.push('/onboarding?edit=1')} />
        </Group>
      ) : (
        <Group title={t('settings.account')}>
          <ListRow
            icon={LogIn}
            label={t('guest.account')}
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
          />
        </Group>
      )}

      <Group title={t('settings.preferences')}>
        <ListRow icon={Languages} label={t('settings.language')} value={t(`languages.${language}`)} onPress={chooseLanguage} />
      </Group>

      <Group title={t('settings.legal')}>
        <ListRow icon={Users} label={t('settings.guidelines')} onPress={() => router.push('/legal/guidelines')} />
        <Divider />
        <ListRow icon={Scale} label={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <Divider />
        <ListRow icon={ShieldCheck} label={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
        <Divider />
        <ListRow
          icon={LifeBuoy}
          label={t('settings.support')}
          value={SUPPORT_EMAIL}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </Group>

      {signedIn && (
        <Group title={t('settings.danger')}>
          {deleting ? (
            <ActivityIndicator color={colors.red} style={styles.spinner} />
          ) : (
            <ListRow icon={Trash2} label={t('settings.deleteAccount')} onPress={confirmDelete} destructive />
          )}
        </Group>
      )}

      <View style={styles.version}>
        <FileText size={14} color={colors.textMuted} />
        <Text variant="caption" color="textMuted">
          UNIverse · {t('settings.version', { v: APP_VERSION })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.xxl,
  },
  groupTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  spinner: {
    paddingVertical: spacing.lg,
  },
  version: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
