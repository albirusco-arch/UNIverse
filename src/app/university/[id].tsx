import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeftRight,
  Bookmark,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Globe,
  MapPin,
  MessageCirclePlus,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SignInCard, useRequireAccount } from '@/components/account-gate';
import { ClubCard } from '@/components/club-card';
import { EquivalenceCard } from '@/components/equivalence-card';
import { GroupRow } from '@/components/group-row';
import { PostCard } from '@/components/post-card';
import { QualityPanel } from '@/components/quality-panel';
import { ScorePill, TopRatedBadge } from '@/components/score';
import { Segmented } from '@/components/segmented';
import { regionGradients } from '@/components/university-card';
import { Badge, Button, Card, EmptyState, Header, IconButton, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import {
  discoverGroups,
  getUniversity,
  listClubs,
  listEquivalences,
  listPosts,
  listSavedUniversityIds,
  listScores,
  setUniversitySaved,
  trackSignal,
} from '@/data/api';
import type { Post, Topic } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji, hostname } from '@/lib/format';
import { scoreTier } from '@/lib/scores';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

type Tab = 'overview' | 'quality' | 'courses' | 'clubs' | 'community';

function PostList({ posts, empty, action }: { posts: Post[] | undefined; empty: string; action: ReactNode }) {
  if (!posts) return null;
  if (posts.length === 0) return <EmptyState icon={Users} text={empty} action={action} />;
  return (
    <View style={styles.list}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {action}
    </View>
  );
}

export default function UniversityScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const university = getUniversity(id);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'overview');
  const { signedIn } = useSession();
  const requireAccount = useRequireAccount();

  const { data: posts } = useQuery(() => listPosts({ universityId: id }), [id]);
  const { data: equivalences } = useQuery(() => listEquivalences({ destinationId: id }), [id]);
  const { data: savedIds } = useQuery(listSavedUniversityIds, []);
  const { data: scores } = useQuery(listScores, []);
  const { data: groups } = useQuery(() => discoverGroups({ universityId: id }), [id]);
  const { data: clubs } = useQuery(() => listClubs(id), [id]);

  // Personalises the community feed ("You looked at …").
  useEffect(() => {
    if (id) trackSignal('view_university', id);
  }, [id]);

  if (!university) {
    return (
      <Screen header={<Header />}>
        <EmptyState icon={Globe} text={t('common.error')} />
      </Screen>
    );
  }

  const saved = savedIds?.includes(university.id) ?? false;
  const score = scores?.[university.id];

  const research = (kind: 'exchange' | 'admission') =>
    requireAccount('research', () =>
      router.navigate({ pathname: '/research', params: { kind, destinationId: university.id } }),
    );
  const compose = (topic: Topic) =>
    router.push({ pathname: '/post/new', params: { universityId: university.id, topic } });
  const addEquivalence = () => router.push({ pathname: '/equivalence/new', params: { destinationId: university.id } });
  const createGroup = () => router.push({ pathname: '/group/new', params: { universityId: university.id } });
  const suggestClub = () =>
    requireAccount('clubs', () => router.push({ pathname: '/club/new', params: { universityId: university.id } }));
  const toggleSaved = () =>
    requireAccount('save', () => {
      if (!saved) trackSignal('save_university', university.id);
      setUniversitySaved(university.id, !saved).catch(() => undefined);
    });

  const header = (
    <Header
      right={
        <IconButton
          label={t('university.saveUniversity')}
          active={saved}
          onPress={toggleSaved}
          icon={<Bookmark size={20} color={saved ? colors.primaryLight : colors.text} fill={saved ? colors.primaryLight : 'transparent'} />}
        />
      }
    />
  );

  return (
    <Screen header={header}>
      <LinearGradient colors={regionGradients[university.region]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.flag}>{flagEmoji(university.countryCode)}</Text>
          <ScorePill score={score} />
        </View>
        <Text variant="title1">{university.name}</Text>
        <View style={styles.location}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text variant="callout" color="textSecondary">
            {university.city ? `${university.city}, ` : ''}
            {university.country}
          </Text>
        </View>
        <View style={styles.badges}>
          <Badge
            tone={university.erasmus ? 'primary' : 'accent'}
            label={university.erasmus ? t('university.erasmus') : t('university.overseas')}
          />
          {university.erasmusCode && <Badge tone="neutral" label={t('university.erasmusCode', { code: university.erasmusCode })} />}
          <TopRatedBadge score={score} />
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <Segmented<Tab>
          scrollable
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: t('university.tabs.overview') },
            { value: 'quality', label: t('university.tabs.quality') },
            { value: 'courses', label: t('university.tabs.courses') },
            { value: 'clubs', label: t('university.tabs.clubs') },
            { value: 'community', label: t('university.tabs.community') },
          ]}
        />
      </View>

      {tab === 'overview' && (
        <View style={styles.stack}>
          <Card tone="primary" style={styles.planCard}>
            <View style={styles.planTitle}>
              <Sparkles size={18} color={colors.primaryLight} />
              <Text variant="title3">{t('university.planHere')}</Text>
            </View>
            <Text variant="callout" color="textSecondary">
              {t('university.planHereBody')}
            </Text>
            <View style={styles.planButtons}>
              <Button title={t('university.matchCourses')} icon={ArrowLeftRight} onPress={() => research('exchange')} />
              <Button
                title={t('university.entryRequirements')}
                icon={GraduationCap}
                variant="secondary"
                onPress={() => research('admission')}
              />
            </View>
          </Card>

          <Card onPress={() => setTab('quality')} accessibilityLabel={t('score.title')} style={styles.scoreTeaser}>
            <View style={styles.flex}>
              <Text variant="overline" color="textMuted">
                {t('score.title')}
              </Text>
              <Text variant="bodyStrong" style={score?.score != null ? { color: colors.text } : undefined}>
                {score?.score != null
                  ? `${score.score}/100 · ${t(`score.tiers.${scoreTier(score.score)}`)}`
                  : t('score.none')}
              </Text>
              <Text variant="caption" color="textMuted">
                {t('score.ratings', { n: score?.ratingCount ?? 0 })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Card>

          {signedIn && (
            <View>
              <SectionHeader title={t('university.groups')} />
              <Card style={styles.groupsCard}>
                {groups && groups.length > 0 ? (
                  groups.slice(0, 3).map((group) => <GroupRow key={group.id} group={group} />)
                ) : (
                  <Text variant="callout" color="textMuted" style={styles.groupsEmpty}>
                    {t('university.noGroups')}
                  </Text>
                )}
                <Button title={t('university.createGroup')} icon={Plus} variant="ghost" size="sm" onPress={createGroup} />
              </Card>
            </View>
          )}

          <View>
            <SectionHeader title={t('university.officialLinks')} />
            <Card style={styles.linksCard}>
              <ListRow
                icon={ExternalLink}
                label={t('university.website')}
                value={hostname(university.website)}
                onPress={() => WebBrowser.openBrowserAsync(university.website)}
              />
            </Card>
          </View>

          {signedIn && (
            <View>
              <SectionHeader
                title={t('university.studentsSay')}
                action={posts?.length ? t('common.seeAll') : undefined}
                onAction={() => setTab('community')}
              />
              {posts && posts.length > 0 ? (
                <PostCard post={posts[0]} />
              ) : (
                <Text variant="callout" color="textMuted">
                  {t('university.noPosts')}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {tab === 'quality' && <QualityPanel university={university} />}

      {tab === 'courses' && !signedIn && <SignInCard feature="equivalences" />}

      {tab === 'courses' && signedIn && (
        <View style={styles.stack}>
          <View>
            <Text variant="title3">{t('university.equivalencesTitle')}</Text>
            <Text variant="callout" color="textSecondary" style={styles.lead}>
              {t('university.equivalencesBody')}
            </Text>
          </View>
          {equivalences && equivalences.length > 0 ? (
            <View style={styles.list}>
              {equivalences.map((e) => (
                <EquivalenceCard key={e.id} equivalence={e} destinationName={university.name} />
              ))}
            </View>
          ) : (
            <EmptyState icon={ArrowLeftRight} text={t('university.noEquivalences')} />
          )}
          <Button title={t('university.addEquivalence')} variant="secondary" icon={ArrowLeftRight} onPress={addEquivalence} />
          <Button title={t('university.matchCourses')} icon={Sparkles} onPress={() => research('exchange')} />
        </View>
      )}

      {tab === 'clubs' && (
        <View style={styles.stack}>
          <View>
            <Text variant="title3">{t('clubs.title')}</Text>
            <Text variant="callout" color="textSecondary" style={styles.lead}>
              {t('clubs.body')}
            </Text>
          </View>
          {clubs && clubs.length > 0 ? (
            <View style={styles.list}>
              {clubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </View>
          ) : (
            <EmptyState icon={Users} text={t('clubs.empty')} />
          )}
          <Button title={t('clubs.suggest')} variant="secondary" icon={Plus} onPress={suggestClub} />
        </View>
      )}

      {tab === 'community' && !signedIn && <SignInCard feature="community" />}

      {tab === 'community' && signedIn && (
        <PostList
          posts={posts}
          empty={t('university.noPosts')}
          action={
            <Button title={t('university.askQuestion')} variant="secondary" icon={MessageCirclePlus} onPress={() => compose('question')} />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flag: {
    fontSize: 44,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  tabs: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  lead: {
    marginTop: spacing.xs,
  },
  flex: {
    flex: 1,
  },
  planCard: {
    gap: spacing.md,
  },
  planTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planButtons: {
    gap: spacing.sm,
  },
  scoreTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  groupsCard: {
    padding: spacing.xs,
  },
  groupsEmpty: {
    padding: spacing.md,
  },
  linksCard: {
    padding: 0,
    overflow: 'hidden',
  },
});
