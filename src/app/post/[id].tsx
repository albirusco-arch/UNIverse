import { router, useLocalSearchParams } from 'expo-router';
import { MessageCircle, MoreHorizontal, SearchX, Send } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthorLine, PostCard } from '@/components/post-card';
import { Card, EmptyState, Header, Screen, SectionHeader, Text } from '@/components/ui';
import { createComment, getPost, listComments } from '@/data/api';
import { t } from '@/i18n';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: post, loading } = useQuery(() => getPost(id), [id]);
  const { data: comments } = useQuery(() => listComments(id), [id]);
  const { ensureSignedIn, commentMenu, isMine } = useModeration();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = draft.trim();
    if (!body || !ensureSignedIn()) return;
    setSending(true);
    try {
      await createComment(id, body);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const composer = (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={t('community.commentPlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('community.commentPlaceholder')}
        multiline
        maxLength={2000}
        style={styles.composerInput}
      />
      <Pressable
        onPress={send}
        disabled={!draft.trim() || sending}
        accessibilityRole="button"
        accessibilityLabel={t('community.send')}
        style={[styles.sendButton, (!draft.trim() || sending) && { opacity: 0.4 }]}>
        {sending ? <ActivityIndicator color="#FFFFFF" /> : <Send size={18} color="#FFFFFF" />}
      </Pressable>
    </View>
  );

  return (
    <Screen header={<Header title={t('community.title')} />} footer={post ? composer : undefined}>
      {!post && loading && <ActivityIndicator color={colors.primaryLight} />}
      {!post && !loading && <EmptyState icon={SearchX} text={t('common.error')} />}
      {post && (
        <>
          <PostCard post={post} expanded onDeleted={() => router.back()} />
          <View style={styles.comments}>
            <SectionHeader title={`${t('community.comments')} (${comments?.length ?? 0})`} />
            {comments?.length === 0 && <EmptyState icon={MessageCircle} text={t('community.noComments')} />}
            <View style={styles.list}>
              {comments?.map((comment) => (
                <Card key={comment.id} style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <AuthorLine author={comment.author} createdAt={comment.createdAt} />
                    {!isMine(comment.author) && (
                      <Pressable
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="More actions"
                        onPress={() => commentMenu(comment)}>
                        <MoreHorizontal size={18} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                  <Text variant="callout" color="textSecondary">
                    {comment.body}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  comments: {
    marginTop: spacing.xxl,
  },
  list: {
    gap: spacing.sm,
  },
  comment: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
