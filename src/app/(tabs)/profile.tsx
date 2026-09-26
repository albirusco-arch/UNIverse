import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, BadgeCheck, Bookmark, LogIn, LogOut, Pencil, Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { UniversityCard } from '@/components/university-card';
import { Avatar, Badge, Button, Card, Divider, EmptyState, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import { getUniversity, getUniversityStats, listMyMatches, listPosts, listSavedUniversityIds } from '@/data/api';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title2">{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, signedIn, email, signOut } = useSession();
  const destination = getUniversity(profile.destinationId);

  const { data: savedIds } = useQuery(listSavedUniversityIds, [signedIn]);
  const { data: matches } = useQuery(listMyMatches, [signedIn]);
  const { data: myPosts } = useQuery(
    () => (signedIn ? listPosts({ authorId: profile.id }) : Promise.resolve([])),
    [signedIn, profile.id],
  );
  const { data: stats } = useQuery(getUniversityStats, []);

  const saved = (savedIds ?? []).map((id) => getUniversity(id)).filter((u) => u !== undefined);
  const name = profile.displayName || (signedIn ? (email?.split('@')[0] ?? '') : t('profile.guest'));

  return (
    <Screen tab>
      <LinearGradient colors={['rgba(124,58,237,0.45)', 'rgba(13,148,136,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <Avatar name={name} size={64} />
          <View style={styles.heroText}>
            <Text variant="title2" numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text variant="callout" color="textSecondary" numberOfLines={1}>
                {email}
              </Text>
            ) : null}
            {signedIn && profile.verified ? (
              <Badge icon={BadgeCheck} tone="violet" label={t('community.verifiedStudent')} />
            ) : null}
          </View>
        </View>
        {!signedIn ? (
          <>
            <Text variant="callout" color="textSecondary">
              {t('profile.guestBody')}
            </Text>
            <Button title={t('common.signIn')} icon={LogIn} onPress={() => router.push('/auth')} />
          </>
        ) : !profile.verified ? (
          <Text variant="caption" color="textSecondary">
            {t('profile.notVerified')}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <Stat value={myPosts?.length ?? 0} label={t('profile.posts')} />
          <Stat value={saved.length} label={t('profile.saved')} />
          <Stat value={matches?.length ?? 0} label={t('profile.matches')} />
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <SectionHeader title={t('profile.myPlan')} action={t('profile.editPlan')} onAction={() => router.push('/onboarding?edit=1')} />
        <Card style={styles.planCard} onPress={() => router.push('/onboarding?edit=1')} accessibilityLabel={t('profile.editPlan')}>
          <View style={styles.planRoute}>
            <Text variant="bodyStrong" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
              {profile.homeUniversity || '—'}
            </Text>
            <ArrowRight size={16} color={colors.violetLight} />
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
              {destination ? `${flagEmoji(destination.countryCode)} ${destination.name}` : t('onboarding.undecided')}
            </Text>
          </View>
          <Text variant="caption" color="textMuted">
            {[
              profile.field ? t(`fields.${profile.field}`) : null,
              profile.level ? t(`levels.${profile.level}`) : null,
              profile.term,
            ]
              .filter(Boolean)
              .join(' · ') || t('home.noPlanTitle')}
          </Text>
          <Pencil size={16} color={colors.textMuted} style={styles.editIcon} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.savedUniversities')} />
        {saved.length > 0 ? (
          <View style={styles.list}>
            {saved.map((university) => (
              <UniversityCard key={university.id} university={university} stats={stats?.[university.id]} saved />
            ))}
          </View>
        ) : (
          <EmptyState icon={Bookmark} text={t('profile.noSaved')} />
        )}
      </View>

      <Card style={[styles.section, styles.menu]}>
        <ListRow icon={Settings} label={t('profile.settings')} onPress={() => router.push('/settings')} />
        {signedIn && (
          <>
            <Divider />
            <ListRow icon={LogOut} label={t('profile.signOut')} onPress={signOut} destructive />
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.45)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  section: {
    marginTop: spacing.xxl,
  },
  planCard: {
    gap: 6,
  },
  planRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.xl,
  },
  flexShrink: {
    flexShrink: 1,
  },
  editIcon: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  menu: {
    padding: 0,
    overflow: 'hidden',
  },
});
