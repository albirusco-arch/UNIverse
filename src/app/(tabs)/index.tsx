import { router } from 'expo-router';
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronRight,
  Compass,
  GraduationCap,
  LogIn,
  Plane,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useRequireAccount } from '@/components/account-gate';
import { Wordmark } from '@/components/brand';
import { BuddiesTeaser } from '@/components/buddies';
import { GroupRow } from '@/components/group-row';
import { MomentsRail } from '@/components/moments';
import { OpportunityCard } from '@/components/opportunity-card';
import { PostCard } from '@/components/post-card';
import { ScoreRing } from '@/components/score';
import { Avatar, Button, Card, DemoBadge, IconButton, Screen, SectionHeader, Text } from '@/components/ui';
import { getUniversity, listForYou, listMoments, listMyGroups, listOpportunities, listScores } from '@/data/api';
import type { Opportunity, Profile, ResearchKind, University, UniversityScore } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { filterOpportunities, NO_OPPORTUNITY_FILTERS } from '@/lib/opportunities';
import { isTopRated } from '@/lib/scores';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const aiShortcuts: { kind: ResearchKind; icon: LucideIcon }[] = [
  { kind: 'exchange', icon: ArrowLeftRight },
  { kind: 'admission', icon: GraduationCap },
  { kind: 'scholarships', icon: Wallet },
  { kind: 'visa', icon: Plane },
];

/** Open listings, those matching the student's field or universities first. */
function forProfile(items: Opportunity[], profile: Profile): Opportunity[] {
  const mine = [profile.homeUniversityId, profile.destinationId];
  const relevance = (item: Opportunity) =>
    Number(item.field !== null && item.field === profile.field) + Number(item.universityId !== null && mine.includes(item.universityId));
  return filterOpportunities(items, NO_OPPORTUNITY_FILTERS)
    .map((item, index) => ({ item, index, score: relevance(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

function PlanCard() {
  const { profile } = useSession();
  const destination = getUniversity(profile.destinationId);

  if (!destination) {
    return (
      <Card tone="primary" style={styles.planCard}>
        <Text variant="title3">{t('home.noPlanTitle')}</Text>
        <Text variant="callout" color="textSecondary">
          {t('home.noPlanBody')}
        </Text>
        <Button title={t('home.setUp')} iconRight={ArrowRight} onPress={() => router.push('/onboarding?edit=1')} />
      </Card>
    );
  }

  const details = [
    profile.field ? t(`fields.${profile.field}`) : null,
    profile.level ? t(`levels.${profile.level}`) : null,
    profile.term,
  ].filter(Boolean);

  return (
    <Card tone="primary" style={styles.planCard}>
      <Text variant="overline" color="primaryPale">
        {t('home.yourExchange')}
      </Text>
      <View style={styles.route}>
        <Text variant="bodyStrong" color="textSecondary" numberOfLines={1} style={styles.routeFrom}>
          {profile.homeUniversity || '—'}
        </Text>
        <ArrowRight size={16} color={colors.primaryLight} />
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/university/[id]', params: { id: destination.id } })}
        accessibilityRole="button">
        <Text variant="title2">
          {flagEmoji(destination.countryCode)} {destination.name}
        </Text>
      </Pressable>
      {details.length > 0 && (
        <Text variant="callout" color="textMuted">
          {details.join(' · ')}
        </Text>
      )}
      <View style={styles.planActions}>
        <Button
          title={t('home.matchCourses')}
          icon={Sparkles}
          onPress={() => router.navigate({ pathname: '/research', params: { kind: 'exchange', destinationId: destination.id } })}
        />
        <Button
          title={t('home.pathStudents')}
          variant="secondary"
          icon={Users}
          onPress={() => router.navigate({ pathname: '/community', params: { feed: 'forYou' } })}
        />
      </View>
    </Card>
  );
}

/** Shown to guests instead of the exchange plan. */
function GuestCard() {
  return (
    <Card tone="primary" style={styles.planCard}>
      <Text variant="title3">{t('guest.homeTitle')}</Text>
      <Text variant="callout" color="textSecondary">
        {t('guest.homeBody')}
      </Text>
      <View style={styles.planActions}>
        <Button
          title={t('welcome.signup')}
          icon={UserPlus}
          onPress={() => router.push({ pathname: '/auth', params: { mode: 'signup' } })}
        />
        <Button title={t('guest.browse')} icon={Compass} variant="secondary" onPress={() => router.navigate('/explore')} />
      </View>
    </Card>
  );
}

function TopRatedCard({ university, score }: { university: University; score: UniversityScore }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/university/[id]', params: { id: university.id, tab: 'quality' } })}
      accessibilityRole="button"
      accessibilityLabel={`${university.name}, ${score.score}`}
      style={({ pressed }) => [styles.topCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.topCardHead}>
        <Text style={styles.topFlag}>{flagEmoji(university.countryCode)}</Text>
        <ScoreRing score={score.score} size={46} />
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {university.name}
      </Text>
      <Text variant="caption" color="textMuted" numberOfLines={1}>
        {university.city || university.country}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { profile, signedIn } = useSession();
  const requireAccount = useRequireAccount();

  const { data: scores } = useQuery(listScores, []);
  const { data: groups } = useQuery(listMyGroups, []);
  const { data: opportunities } = useQuery(listOpportunities, []);
  const { data: moments } = useQuery(() => (signedIn ? listMoments() : Promise.resolve([])), [signedIn]);
  const { data: forYou } = useQuery(
    () => listForYou(profile),
    [profile.destinationId, profile.field, profile.homeUniversity],
  );

  const topRated = Object.values(scores ?? {})
    .filter((s) => isTopRated(s))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((s) => ({ score: s, university: getUniversity(s.universityId) }))
    .filter((item): item is { score: UniversityScore; university: University } => Boolean(item.university))
    .slice(0, 8);
  const activeGroups = (groups ?? []).slice(0, 3);
  const posts = (forYou ?? []).slice(0, 2);
  const firstName = profile.displayName.split(' ')[0];
  const topOpportunities = forProfile(opportunities ?? [], profile).slice(0, 3);

  return (
    <Screen tab>
      <View style={styles.topBar}>
        <Wordmark size={13} />
        <View style={styles.topRight}>
          <DemoBadge />
          {signedIn ? (
            <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('profile.title')}>
              <Avatar name={profile.displayName || '?'} size={40} />
            </Pressable>
          ) : (
            <>
              <IconButton
                label={t('settings.title')}
                icon={<Settings size={20} color={colors.text} />}
                onPress={() => router.push('/settings')}
              />
              <Button
                title={t('welcome.login')}
                icon={LogIn}
                variant="secondary"
                size="sm"
                onPress={() => router.push({ pathname: '/auth', params: { mode: 'login' } })}
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.hero}>
        <Text variant="title1">{firstName ? t('home.greeting', { name: firstName }) : t('welcome.title')}</Text>
      </View>

      {signedIn && moments && (
        <View style={styles.firstSection}>
          <SectionHeader
            title={t('home.moments')}
            action={t('common.seeAll')}
            onAction={() => router.navigate({ pathname: '/community', params: { section: 'clubs' } })}
          />
          <MomentsRail moments={moments.slice(0, 10)} onPost={() => router.push('/moment/new')} />
        </View>
      )}

      {topOpportunities.length > 0 && (
        <View style={signedIn ? styles.section : styles.firstSection}>
          <SectionHeader title={t('home.opportunities')} action={t('common.seeAll')} onAction={() => router.navigate('/opportunities')} />
          <View style={styles.list}>
            {topOpportunities.map((item) => (
              <OpportunityCard key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>{signedIn ? <PlanCard /> : <GuestCard />}</View>
      {signedIn && !!profile.destinationId && (
        <View style={styles.buddies}>
          <BuddiesTeaser />
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title={t('home.aiTitle')} />
        <View style={styles.aiList}>
          {aiShortcuts.map((item, index) => (
            <Pressable
              key={item.kind}
              onPress={() =>
                requireAccount('research', () => router.navigate({ pathname: '/research', params: { kind: item.kind } }))
              }
              accessibilityRole="button"
              accessibilityLabel={t(`research.kinds.${item.kind}`)}
              style={({ pressed }) => [styles.aiItem, index > 0 && styles.aiBorder, pressed && { backgroundColor: colors.surfacePressed }]}>
              <item.icon size={18} color={colors.textSecondary} strokeWidth={1.9} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {t(`research.kinds.${item.kind}`)}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {t(`research.kindBodies.${item.kind}`)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>

      {topRated.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title={t('home.topRated')}
            action={t('common.seeAll')}
            onAction={() => router.navigate({ pathname: '/explore', params: { sort: 'top' } })}
          />
          <Text variant="caption" color="textMuted" style={styles.sectionBody}>
            {t('home.topRatedBody')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
            {topRated.map(({ university, score }) => (
              <TopRatedCard key={university.id} university={university} score={score} />
            ))}
          </ScrollView>
        </View>
      )}

      {activeGroups.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('home.yourGroups')} action={t('common.seeAll')} onAction={() => router.navigate('/groups')} />
          <Card style={styles.groups}>
            {activeGroups.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
          </Card>
        </View>
      )}

      {posts.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('home.forYou')} action={t('common.seeAll')} onAction={() => router.navigate('/community')} />
          <View style={styles.list}>
            {posts.map(({ post, reason }) => (
              <PostCard key={post.id} post={post} reason={reason} />
            ))}
          </View>
        </View>
      )}

      <Text variant="caption" color="textMuted" style={styles.section}>
        {t('home.trustBody')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hero: {
    marginTop: spacing.xxl,
  },
  firstSection: {
    marginTop: spacing.xl,
  },
  planCard: {
    gap: spacing.sm,
  },
  buddies: {
    marginTop: spacing.md,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  routeFrom: {
    flexShrink: 1,
  },
  planActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionBody: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  aiList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  aiItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  aiBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rail: {
    marginHorizontal: -gutter,
  },
  railContent: {
    paddingHorizontal: gutter,
    gap: spacing.md,
  },
  topCard: {
    width: 156,
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  topCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  topFlag: {
    fontSize: 30,
  },
  groups: {
    padding: spacing.xs,
  },
  list: {
    gap: spacing.md,
  },
});
