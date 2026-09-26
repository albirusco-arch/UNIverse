import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { BadgeCheck, Bookmark, Heart, MessageCircle, MoreHorizontal, Plane, Sparkles } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Text, type BadgeTone } from '@/components/ui';
import { getUniversity, setPostLiked, setPostSaved } from '@/data/api';
import type { Author, Post, Topic } from '@/data/types';
import { t } from '@/i18n';
import type { RankReason } from '@/lib/feed-ranking';
import { timeAgo } from '@/lib/format';
import { useModeration } from '@/lib/use-moderation';
import { colors, spacing } from '@/theme/tokens';

const topicTones: Record<Topic, BadgeTone> = {
  question: 'primary',
  experience: 'success',
  housing: 'amber',
  tip: 'neutral',
};

/** "Biochemistry · University of Milan → Heidelberg University" */
export function authorPath(author: Author): string {
  const parts: string[] = [];
  if (author.field) parts.push(t(`fields.${author.field}`));
  const destination = getUniversity(author.destinationId);
  const route = [author.homeUniversity, destination?.name].filter(Boolean).join(' → ');
  if (route) parts.push(route);
  return parts.join(' · ');
}

export function AuthorLine({ author, createdAt }: { author: Author; createdAt: string }) {
  return (
    <View style={styles.authorRow}>
      <Avatar name={author.displayName} size={42} />
      <View style={styles.authorText}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {author.displayName}
          </Text>
          {author.verified && (
            <BadgeCheck
              size={16}
              color={colors.primaryLight}
              strokeWidth={2.4}
              accessibilityLabel={t('community.verifiedStudent')}
            />
          )}
          <Text variant="caption" color="textMuted">
            · {timeAgo(createdAt)}
          </Text>
        </View>
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.path}>
          {authorPath(author)}
        </Text>
      </View>
    </View>
  );
}

/** Why a post is in the "For you" feed, in a few words. */
export function reasonLabel(reason: RankReason): string {
  switch (reason.kind) {
    case 'interest':
      return t('community.reasons.interest', { name: getUniversity(reason.universityId)?.name ?? '' });
    case 'keyword':
      return t('community.reasons.keyword', { keyword: reason.keyword });
    default:
      return t(`community.reasons.${reason.kind}`);
  }
}

type PostCardProps = {
  post: Post;
  reason?: RankReason | null;
  /** Show the full text instead of a preview (post detail screen). */
  expanded?: boolean;
  onDeleted?: () => void;
};

export function PostCard({ post, reason, expanded = false, onDeleted }: PostCardProps) {
  const { postMenu, ensureSignedIn } = useModeration();
  const university = getUniversity(post.universityId);

  const tap = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
  };

  const toggleLike = () => {
    if (!ensureSignedIn()) return;
    tap();
    setPostLiked(post, !post.likedByMe).catch(() => undefined);
  };

  const toggleSave = () => {
    if (!ensureSignedIn()) return;
    tap();
    setPostSaved(post, !post.savedByMe).catch(() => undefined);
  };

  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });

  return (
    <Card style={styles.card}>
      {reason && (
        <View style={styles.reason}>
          <Sparkles size={12} color={colors.accentLight} />
          <Text variant="caption" color="accentLight" numberOfLines={1} style={styles.reasonText}>
            {reasonLabel(reason)}
          </Text>
        </View>
      )}
      <View style={styles.header}>
        <AuthorLine author={post.author} createdAt={post.createdAt} />
        <Pressable
          onPress={() => postMenu(post, onDeleted)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="More actions">
          <MoreHorizontal size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Pressable onPress={expanded ? undefined : open} disabled={expanded} accessibilityRole={expanded ? undefined : 'button'}>
        <View style={styles.badges}>
          <Badge label={t(`topics.${post.topic}`)} tone={topicTones[post.topic]} />
          {university && <Badge label={university.name} icon={Plane} />}
        </View>
        <Text variant="body" color="textSecondary" numberOfLines={expanded ? undefined : 5} style={styles.body}>
          {post.body}
        </Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={toggleLike}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
          accessibilityLabel={`Like, ${post.likeCount}`}
          style={styles.action}>
          <Heart
            size={18}
            color={post.likedByMe ? colors.red : colors.textMuted}
            fill={post.likedByMe ? colors.red : 'transparent'}
          />
          <Text variant="caption" color="textMuted">
            {post.likeCount}
          </Text>
        </Pressable>
        <Pressable
          onPress={open}
          disabled={expanded}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${t('community.comments')}, ${post.commentCount}`}
          style={styles.action}>
          <MessageCircle size={18} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {post.commentCount}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: post.savedByMe }}
          accessibilityLabel={post.savedByMe ? t('common.saved') : t('common.save')}
          style={[styles.action, styles.save]}>
          <Bookmark
            size={18}
            color={post.savedByMe ? colors.primaryLight : colors.textMuted}
            fill={post.savedByMe ? colors.primaryLight : 'transparent'}
          />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: -spacing.xs,
  },
  reasonText: {
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  authorRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  authorText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flexShrink: 1,
  },
  path: {
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  body: {
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
  },
  save: {
    marginLeft: 'auto',
  },
});
