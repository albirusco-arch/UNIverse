import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, MessagesSquare, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SignInScreen } from '@/components/account-gate';
import { ClubCard } from '@/components/club-card';
import { MomentsRail } from '@/components/moments';
import { PostCard } from '@/components/post-card';
import { Segmented } from '@/components/segmented';
import { Button, Chip, ChipScroller, DemoBadge, EmptyState, IconButton, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { getUniversity, listClubs, listForYou, listMoments, listPosts, trackSignal, type PostFilter } from '@/data/api';
import { TOPICS, type Club, type Topic } from '@/data/types';
import { t } from '@/i18n';
import type { RankedPost } from '@/lib/feed-ranking';
import { trendingClubs } from '@/lib/moments';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

type Section = 'clubs' | 'posts';
type Feed = 'forYou' | 'latest';
type Filter = 'all' | Topic;

/** Club life: live moments, the clubs everyone is talking about and the clubs of your universities. */
function ClubsSection() {
  const { profile } = useSession();
  const universityIds = [profile.homeUniversityId, profile.destinationId].filter((id): id is string => Boolean(id));
  const { data: moments, loading } = useQuery(() => listMoments(), []);
  const { data: clubs } = useQuery(
    async (): Promise<Club[]> => (await Promise.all(universityIds.map((id) => listClubs(id)))).flat(),
    [universityIds.join()],
  );

  // Moments from your universities first, then everyone else's: word of mouth travels.
  const mine = (id: string | null) => (id !== null && universityIds.includes(id) ? 0 : 1);
  const live = [...(moments ?? [])].sort((a, b) => mine(a.universityId) - mine(b.universityId));
  const trending = trendingClubs(moments ?? []).slice(0, 5);
  const post = () => router.push('/moment/new');

  return (
    <>
      <View style={styles.section}>
        <SectionHeader title={t('moments.title')} />
        <Text variant="caption" color="textMuted" style={styles.sectionBody}>
          {t('moments.body')}
        </Text>
        {!moments && loading ? <ActivityIndicator color={colors.textMuted} /> : <MomentsRail moments={live} onPost={post} />}
        {moments?.length === 0 && (
          <Text variant="caption" color="textMuted" style={styles.emptyMoments}>
            {t('moments.empty')}
          </Text>
        )}
      </View>

      {trending.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('moments.trending')} />
          <Text variant="caption" color="textMuted" style={styles.sectionBody}>
            {t('moments.trendingBody')}
          </Text>
          <View style={styles.rows}>
            {trending.map((club, index) => (
              <Pressable
                key={club.clubId}
                onPress={() => router.push({ pathname: '/club/[id]', params: { id: club.clubId } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && { backgroundColor: colors.surfacePressed }]}>
                <Text variant="title3" color="textMuted" style={styles.rank}>
                  {index + 1}
                </Text>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {club.clubName}
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {[
                      club.universityId ? getUniversity(club.universityId)?.name : null,
                      t('moments.count', { n: club.moments }),
                      t('moments.reactions', { n: club.reactions }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {clubs && clubs.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title={t('moments.myClubs')} />
          <View style={styles.list}>
            {clubs.map((club) => (
              <ClubCard key={club.id} club={club} />
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function PostsSection({ initialFeed }: { initialFeed: Feed }) {
  const { profile } = useSession();
  const [feed, setFeed] = useState<Feed>(initialFeed);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');

  const postFilter: PostFilter = { query: searched, topics: filter === 'all' ? undefined : [filter] };
  const { data: posts, loading } = useQuery<RankedPost[]>(
    async () =>
      feed === 'forYou'
        ? listForYou(profile, postFilter)
        : (await listPosts(postFilter)).map((post) => ({ post, score: 0, reason: null })),
    [feed, filter, searched, profile.destinationId, profile.field, profile.homeUniversity],
  );

  // Searches are a personalisation signal; record them when submitted, not per keystroke.
  const submitSearch = () => {
    setSearched(query);
    if (query.trim().length >= 3) trackSignal('search', query);
  };

  const compose = () =>
    router.push({ pathname: '/post/new', params: profile.destinationId ? { universityId: profile.destinationId } : {} });

  return (
    <>
      <View style={styles.segment}>
        <Segmented<Feed>
          value={feed}
          onChange={setFeed}
          options={[
            { value: 'forYou', label: t('community.forYou') },
            { value: 'latest', label: t('community.latest') },
          ]}
        />
      </View>

      <Input
        icon={Search}
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          if (!value) setSearched('');
        }}
        onSubmitEditing={submitSearch}
        onBlur={submitSearch}
        placeholder={t('community.searchPlaceholder')}
        returnKeyType="search"
        containerStyle={styles.search}
      />
      <ChipScroller>
        {(['all', ...TOPICS] as Filter[]).map((f) => (
          <Chip
            key={f}
            label={f === 'all' ? t('community.all') : t(`topics.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ChipScroller>

      <View style={styles.list}>
        {!posts && loading && <ActivityIndicator color={colors.primaryLight} />}
        {posts?.length === 0 && (
          <EmptyState
            icon={MessagesSquare}
            text={t('community.empty')}
            action={<Button title={t('community.newPost')} icon={Plus} size="sm" onPress={compose} />}
          />
        )}
        {posts?.map(({ post, reason }) => (
          <PostCard key={post.id} post={post} reason={feed === 'forYou' ? reason : null} />
        ))}
      </View>
    </>
  );
}

function CommunityScreenContent() {
  const params = useLocalSearchParams<{ feed?: string; section?: string }>();
  const { profile } = useSession();
  const [section, setSection] = useState<Section>(params.feed || params.section === 'posts' ? 'posts' : 'clubs');

  const compose = () =>
    section === 'clubs'
      ? router.push('/moment/new')
      : router.push({ pathname: '/post/new', params: profile.destinationId ? { universityId: profile.destinationId } : {} });

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text variant="title1" accessibilityRole="header">
            {t('community.title')}
          </Text>
          <DemoBadge />
        </View>
        <IconButton
          label={section === 'clubs' ? t('moments.new') : t('community.newPost')}
          onPress={compose}
          icon={<Plus size={22} color={colors.text} />}
        />
      </View>

      <View style={styles.segment}>
        <Segmented<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'clubs', label: t('community.clubsTab') },
            { value: 'posts', label: t('community.postsTab') },
          ]}
        />
      </View>

      {section === 'clubs' ? <ClubsSection /> : <PostsSection initialFeed={params.feed === 'latest' ? 'latest' : 'forYou'} />}
    </Screen>
  );
}

export default function CommunityScreen() {
  const { signedIn } = useSession();
  if (!signedIn) return <SignInScreen feature="community" title={t('community.title')} />;
  return <CommunityScreenContent />;
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  segment: {
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionBody: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  emptyMoments: {
    marginTop: spacing.sm,
  },
  rows: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rank: {
    width: 20,
  },
  flex: {
    flex: 1,
  },
  search: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
