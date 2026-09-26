import { router, useLocalSearchParams } from 'expo-router';
import { MessagesSquare, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SignInScreen } from '@/components/account-gate';
import { PostCard } from '@/components/post-card';
import { Segmented } from '@/components/segmented';
import { Button, Chip, ChipScroller, DemoBadge, EmptyState, IconButton, Input, Screen, Text } from '@/components/ui';
import { listForYou, listPosts, trackSignal, type PostFilter } from '@/data/api';
import { TOPICS, type Topic } from '@/data/types';
import { t } from '@/i18n';
import type { RankedPost } from '@/lib/feed-ranking';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

type Feed = 'forYou' | 'latest';
type Filter = 'all' | Topic;

function CommunityScreenContent() {
  const params = useLocalSearchParams<{ feed?: string }>();
  const { profile } = useSession();
  const [feed, setFeed] = useState<Feed>(params.feed === 'latest' ? 'latest' : 'forYou');
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
    <Screen tab>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text variant="title1" accessibilityRole="header">
            {t('community.title')}
          </Text>
          <DemoBadge />
        </View>
        <IconButton label={t('community.newPost')} onPress={compose} icon={<Plus size={22} color={colors.text} />} />
      </View>

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
  search: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
