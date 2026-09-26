import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, BadgeCheck, Bookmark, LogOut, Pencil, Settings, Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { UniversityCard } from '@/components/university-card';
import { Avatar, Badge, Card, Divider, EmptyState, Header, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import {
  countryName,
  getUniversity,
  getUniversityStats,
  listMyResearch,
  listPosts,
  listSavedUniversityIds,
  listScores,
} from '@/data/api';
import { t } from '@/i18n';
import { flagEmoji, formatDate } from '@/lib/format';
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
  const { profile, email, signOut } = useSession();
  const destination = getUniversity(profile.destinationId);

  const { data: savedIds } = useQuery(listSavedUniversityIds, []);
  const { data: research } = useQuery(listMyResearch, []);
  const { data: myPosts } = useQuery(() => listPosts({ authorId: profile.id }), [profile.id]);
  const { data: stats } = useQuery(getUniversityStats, []);
  const { data: scores } = useQuery(listScores, []);

  const saved = (savedIds ?? []).map((id) => getUniversity(id)).filter((u) => u !== undefined);
  const name = profile.displayName || (email?.split('@')[0] ?? '');

  const logOut = async () => {
    await signOut();
    router.replace('/welcome');
  };

  return (
    <Screen header={<Header title={t('profile.title')} />}>
      <LinearGradient
        colors={['rgba(79,107,255,0.45)', 'rgba(163,91,245,0.25)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
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
            {profile.verified ? <Badge icon={BadgeCheck} tone="primary" label={t('profile.verified')} /> : null}
          </View>
        </View>
        <View style={styles.stats}>
          <Stat value={myPosts?.length ?? 0} label={t('profile.posts')} />
          <Stat value={saved.length} label={t('profile.saved')} />
          <Stat value={research?.length ?? 0} label={t('profile.research')} />
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <SectionHeader title={t('profile.myPlan')} action={t('profile.editPlan')} onAction={() => router.push('/onboarding?edit=1')} />
        <Card style={styles.planCard} onPress={() => router.push('/onboarding?edit=1')} accessibilityLabel={t('profile.editPlan')}>
          <View style={styles.planRoute}>
            <Text variant="bodyStrong" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
              {profile.homeUniversity || '—'}
            </Text>
            <ArrowRight size={16} color={colors.primaryLight} />
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

      {research && research.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('research.history')} action={t('common.seeAll')} onAction={() => router.navigate('/research')} />
          <Card style={styles.menu}>
            {research.slice(0, 3).map((item, index) => (
              <View key={item.id}>
                {index > 0 && <Divider />}
                <ListRow
                  icon={Sparkles}
                  label={`${t(`research.kinds.${item.kind}`)} · ${
                    getUniversity(item.request.destinationId)?.name ??
                    (item.request.destinationName || countryName(item.request.destinationCountry))
                  }`}
                  value={formatDate(item.createdAt)}
                  onPress={() => router.push({ pathname: '/research/[id]', params: { id: item.id } })}
                />
              </View>
            ))}
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title={t('profile.savedUniversities')} />
        {saved.length > 0 ? (
          <View style={styles.list}>
            {saved.map((university) => (
              <UniversityCard
                key={university.id}
                university={university}
                stats={stats?.[university.id]}
                score={scores?.[university.id]}
                saved
              />
            ))}
          </View>
        ) : (
          <EmptyState icon={Bookmark} text={t('profile.noSaved')} />
        )}
      </View>

      <Card style={[styles.section, styles.menu]}>
        <ListRow icon={Settings} label={t('profile.settings')} onPress={() => router.push('/settings')} />
        <Divider />
        <ListRow icon={LogOut} label={t('profile.signOut')} onPress={logOut} destructive />
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
    backgroundColor: 'rgba(7,10,19,0.45)',
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
