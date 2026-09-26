import { router } from 'expo-router';
import {
  ArrowLeftRight,
  Bookmark,
  LogIn,
  MessagesSquare,
  Sparkles,
  Star,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Header, IconTile, Screen, Text } from '@/components/ui';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { gradients, spacing } from '@/theme/tokens';

/** Features that need an account. Guests browse the catalogue and general university info only. */
export type GatedFeature = 'research' | 'community' | 'groups' | 'save' | 'equivalences' | 'rate' | 'clubs' | 'profile';

const icons: Record<GatedFeature, LucideIcon> = {
  research: Sparkles,
  community: MessagesSquare,
  groups: Users,
  save: Bookmark,
  equivalences: ArrowLeftRight,
  rate: Star,
  clubs: Users,
  profile: UserRound,
};

const logIn = () => router.push({ pathname: '/auth', params: { mode: 'login' } });
const signUp = () => router.push({ pathname: '/auth', params: { mode: 'signup' } });

/** Friendly invitation to log in or sign up, shown where a guest meets a gated feature. */
export function SignInCard({ feature }: { feature: GatedFeature }) {
  return (
    <Card tone="primary" style={styles.card}>
      <IconTile icon={icons[feature]} colors={gradients.primary} size={48} />
      <Text variant="title3" align="center">
        {t(`guest.${feature}.title`)}
      </Text>
      <Text variant="callout" color="textSecondary" align="center">
        {t(`guest.${feature}.body`)}
      </Text>
      <View style={styles.buttons}>
        <Button title={t('welcome.signup')} icon={UserPlus} onPress={signUp} />
        <Button title={t('welcome.login')} icon={LogIn} variant="secondary" onPress={logIn} />
      </View>
    </Card>
  );
}

/** A whole screen in place of a route (or tab, with its `title`) guests cannot open. */
export function SignInScreen({ feature, title }: { feature: GatedFeature; title?: string }) {
  const tab = title !== undefined;
  return (
    <Screen tab={tab} header={tab ? undefined : <Header />}>
      {tab && (
        <Text variant="title1" accessibilityRole="header">
          {title}
        </Text>
      )}
      <View style={styles.screen}>
        <SignInCard feature={feature} />
      </View>
    </Screen>
  );
}

/** Wraps a screen so guests see a sign-in invitation instead of it. */
export function requireAccount<P extends object>(Component: ComponentType<P>, feature: GatedFeature) {
  function AccountOnly(props: P) {
    const { signedIn } = useSession();
    if (!signedIn) return <SignInScreen feature={feature} />;
    return <Component {...props} />;
  }
  AccountOnly.displayName = `requireAccount(${Component.displayName ?? Component.name})`;
  return AccountOnly;
}

/**
 * For actions (save, rate, open a chat…): returns a function that runs the
 * action for signed-in students and offers guests to log in or sign up.
 */
export function useRequireAccount() {
  const { signedIn } = useSession();
  const { showSheet } = useFeedback();
  return (feature: GatedFeature, action: () => void) => {
    if (signedIn) return action();
    showSheet({
      title: t(`guest.${feature}.title`),
      message: t(`guest.${feature}.body`),
      options: [
        { label: t('welcome.signup'), onPress: signUp },
        { label: t('welcome.login'), onPress: logIn },
      ],
      cancelLabel: t('guest.notNow'),
    });
  };
}

const styles = StyleSheet.create({
  screen: {
    marginTop: spacing.xl,
  },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
