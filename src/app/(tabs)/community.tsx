import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, MessagesSquare, Plus, Route, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { Button, Chip, ChipScroller, EmptyState, IconButton, Input, Screen, Text } from '@/components/ui';
import { listPosts, type PostFilter } from '@/data/api';
import { TOPICS, type Topic } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

type Filter = 'all' | 'path' | 'verified' | Topic;

export default function CommunityScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const { profile } = useSession();
  const { ensureSignedIn } = useModeration();
  const [filter, setFilter] = useState<Filter>(params.filter === 'path' ? 'path' : 'all');
  const [query, setQuery] = useState('');

  // Home can link here with the "my path" filter; adopt it when the param changes.
  const [seenParam, setSeenParam] = useState(params.filter);
  if (params.filter !== seenParam) {
    setSeenParam(params.filter);
    if (params.filter === 'path') setFilter('path');
  }

  const postFilter: PostFilter = { query };
  if (filter === 'path') {
    // Same destination if known, otherwise same field of study.
    if (profile.destinationId) postFilter.universityId = profile.destinationId;
    else postFilter.field = profile.field;
  } else if (filter === 'verified') {
    postFilter.verifiedOnly = true;
  } else if (filter !== 'all') {
    postFilter.topics = [filter];
  }

  const { data: posts, loading } = useQuery(
    () => listPosts(postFilter),
    [filter, query, profile.destinationId, profile.field],
  );

  const compose = () => {
    if (!ensureSignedIn()) return;
    router.push({ pathname: '/post/new', params: profile.destinationId ? { universityId: profile.destinationId } : {} });
  };

  const filters: { value: Filter; label: string; icon?: typeof Route }[] = [
    { value: 'all', label: t('community.all') },
    { value: 'path', label: t('community.myPath'), icon: Route },
    ...TOPICS.map((topic) => ({ value: topic as Filter, label: t(`topics.${topic}`) })),
    { value: 'verified', label: t('community.verified'), icon: BadgeCheck },
  ];

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text variant="title1" accessibilityRole="header">
            {t('community.title')}
          </Text>
          <Text variant="callout" color="textMuted">
            {t('community.subtitle')}
          </Text>
        </View>
        <IconButton label={t('community.newPost')} onPress={compose} icon={<Plus size={22} color={colors.text} />} />
      </View>

      <Input
        icon={Search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('community.searchPlaceholder')}
        returnKeyType="search"
        containerStyle={styles.search}
      />
      <ChipScroller>
        {filters.map((f) => (
          <Chip key={f.value} label={f.label} icon={f.icon} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ChipScroller>

      <View style={styles.list}>
        {!posts && loading && <ActivityIndicator color={colors.violetLight} />}
        {posts?.length === 0 && (
          <EmptyState
            icon={MessagesSquare}
            text={t('community.empty')}
            action={<Button title={t('community.newPost')} icon={Plus} size="sm" onPress={compose} />}
          />
        )}
        {posts?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleText: {
    flex: 1,
  },
  search: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
