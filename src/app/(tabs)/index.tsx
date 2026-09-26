import { router } from 'expo-router';
import {
  ArrowLeftRight,
  ArrowRight,
  Briefcase,
  FileSearch,
  GraduationCap,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand';
import { GradientText } from '@/components/gradient-text';
import { GroupRow } from '@/components/group-row';
import { PostCard } from '@/components/post-card';
import { ScoreRing } from '@/components/score';
import { TokenBadge } from '@/components/tokens';
import { Avatar, Button, Card, DemoBadge, IconTile, Screen, SectionHeader, Text } from '@/components/ui';
import { getUniversity, listForYou, listMyGroups, listScores } from '@/data/api';
import type { ResearchKind, University, UniversityScore } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { isTopRated } from '@/lib/scores';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, gutter, radius, spacing, type } from '@/theme/tokens';

const aiShortcuts: { kind: ResearchKind; icon: LucideIcon; colors: typeof gradients.primary }[] = [
  { kind: 'exchange', icon: ArrowLeftRight, colors: gradients.primary },
  { kind: 'admission', icon: GraduationCap, colors: gradients.accent },
  { kind: 'scholarships', icon: Wallet, colors: gradients.success },
  { kind: 'visa', icon: Plane, colors: gradients.sky },
];

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
  const { profile } = useSession();

  const { data: scores } = useQuery(listScores, []);
  const { data: groups } = useQuery(listMyGroups, []);
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

  return (
    <Screen tab>
      <View style={styles.topBar}>
        <Wordmark size={16} />
        <View style={styles.topRight}>
          <DemoBadge />
          <TokenBadge />
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel={t('profile.title')}>
            <Avatar name={profile.displayName || '?'} size={40} />
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        {firstName ? (
          <Text variant="callout" color="textMuted" style={styles.greeting}>
            {t('home.greeting', { name: firstName })}
          </Text>
        ) : null}
        <Text variant="display">{t('welcome.title')}</Text>
        <GradientText text={t('welcome.accent')} style={type.display} />
      </View>

      <PlanCard />

      <View style={styles.section}>
        <SectionHeader title={t('home.aiTitle')} />
        <View style={styles.aiGrid}>
          {aiShortcuts.map((item) => (
            <Pressable
              key={item.kind}
              onPress={() => router.navigate({ pathname: '/research', params: { kind: item.kind } })}
              accessibilityRole="button"
              accessibilityLabel={t(`research.kinds.${item.kind}`)}
              style={({ pressed }) => [styles.aiItem, pressed && { opacity: 0.85 }]}>
              <IconTile icon={item.icon} colors={item.colors} size={36} />
              <Text variant="bodyStrong" numberOfLines={1}>
                {t(`research.kinds.${item.kind}`)}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {t(`research.kindBodies.${item.kind}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('home.careerTitle')} />
        <View style={styles.aiGrid}>
          {(
            [
              { href: '/cv', icon: FileSearch, colors: gradients.accent, title: t('career.cvTitle'), body: t('career.cvBody') },
              { href: '/opportunities', icon: Briefcase, colors: gradients.indigo, title: t('career.matchTitle'), body: t('career.matchBody') },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [styles.aiItem, pressed && { opacity: 0.85 }]}>
              <IconTile icon={item.icon} colors={item.colors} size={36} />
              <Text variant="bodyStrong" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {item.body}
              </Text>
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

      <Card tone="success" style={[styles.section, styles.trust]}>
        <View style={styles.trustIcon}>
          <ShieldCheck size={20} color={colors.successLight} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('home.trustTitle')}</Text>
          <Text variant="callout" color="textSecondary">
            {t('home.trustBody')}
          </Text>
        </View>
      </Card>
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
    marginBottom: spacing.xl,
  },
  greeting: {
    marginBottom: spacing.xs,
  },
  planCard: {
    gap: spacing.sm,
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
  aiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  aiItem: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    borderColor: colors.successBorder,
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
  trust: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.xl,
  },
  trustIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
