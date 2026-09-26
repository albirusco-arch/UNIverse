import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Info, Lock, Megaphone, SendHorizontal } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requireAccount } from '@/components/account-gate';
import { useFeedback, type SheetOption } from '@/components/feedback';
import { GroupAvatar } from '@/components/group-row';
import { Button, GlowBackground, Text } from '@/components/ui';
import {
  deleteMessage,
  getGroup,
  joinGroup,
  listMessages,
  markGroupRead,
  sendMessage,
  subscribeToGroup,
} from '@/data/api';
import type { Group, GroupMessage } from '@/data/types';
import { locale, t } from '@/i18n';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const NAME_COLORS = ['#8A9CFF', '#C495FA', '#6EE7B7', '#FBBF24', '#80B8F8', '#F9A8D4'];

function nameColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

/** "Today", "Yesterday" or a short date, for the separators between days. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t('groups.today');
  if (date.toDateString() === yesterday.toDateString()) return t('groups.yesterday');
  return date.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

function Bubble({
  message,
  mine,
  showAuthor,
  onLongPress,
}: {
  message: GroupMessage;
  mine: boolean;
  showAuthor: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityHint={t('common.report')}
      style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        {showAuthor && !mine && (
          <Text variant="caption" style={{ color: nameColor(message.author.id) }} numberOfLines={1}>
            {message.author.displayName}
          </Text>
        )}
        <Text variant="body" style={styles.bubbleText}>
          {message.body}
        </Text>
        <Text variant="caption" style={[styles.time, mine && styles.timeMine]}>
          {clock(message.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function Composer({ group }: { group: Group }) {
  const insets = useSafeAreaInsets();
  const { toast } = useFeedback();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = { paddingBottom: Math.max(insets.bottom, spacing.md) };

  if (group.myRole === null) {
    const join = async () => {
      setBusy(true);
      try {
        await joinGroup(group.id);
      } catch {
        toast(t('common.error'));
      } finally {
        setBusy(false);
      }
    };
    return (
      <View style={[styles.composerBar, bottom]}>
        <Text variant="caption" color="textMuted" align="center">
          {t('groups.joinToRead')}
        </Text>
        <Button title={t('common.join')} onPress={join} loading={busy} />
      </View>
    );
  }

  if (group.kind === 'channel' && group.myRole === 'member') {
    return (
      <View style={[styles.composerBar, bottom]}>
        <View style={styles.inlineCenter}>
          <Megaphone size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {t('groups.onlyAdmins')}
          </Text>
        </View>
      </View>
    );
  }

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setText('');
    try {
      await sendMessage(group.id, body);
    } catch {
      setText(body);
      toast(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.composer, bottom]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('groups.messagePlaceholder')}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primaryLight}
        accessibilityLabel={t('groups.messagePlaceholder')}
        multiline
        maxLength={2000}
        style={styles.input}
      />
      <Pressable
        onPress={send}
        disabled={!text.trim() || busy}
        accessibilityRole="button"
        accessibilityLabel={t('community.send')}
        style={({ pressed }) => [styles.send, (!text.trim() || busy) && styles.sendDisabled, pressed && { opacity: 0.8 }]}>
        <SendHorizontal size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { showSheet, toast } = useFeedback();
  const { report, block, isMine } = useModeration();

  const { data: group, loading } = useQuery(() => getGroup(id), [id]);
  const member = group?.myRole != null;
  const { data: messages, refresh } = useQuery(
    () => (member ? listMessages(id) : Promise.resolve([] as GroupMessage[])),
    [id, member],
  );

  // New messages arrive through Supabase Realtime while the chat is open.
  useEffect(() => (member ? subscribeToGroup(id, refresh) : undefined), [id, member, refresh]);

  const lastId = messages?.[messages.length - 1]?.id;
  useEffect(() => {
    if (member && lastId) markGroupRead(id).catch(() => undefined);
  }, [id, member, lastId]);

  const admin = group?.myRole === 'owner' || group?.myRole === 'admin';

  const messageMenu = (message: GroupMessage) => {
    const mine = isMine(message.author);
    const options: SheetOption[] = [];
    if (mine || admin) {
      options.push({
        label: t('groups.deleteMessage'),
        destructive: true,
        onPress: () => {
          deleteMessage(message.id).catch(() => toast(t('common.error')));
        },
      });
    }
    if (!mine) {
      options.push({ label: t('common.report'), onPress: () => report('message', message.id) });
      options.push({ label: t('common.block'), destructive: true, onPress: () => block(message.author, refresh) });
    }
    if (options.length) showSheet({ options });
  };

  // Newest first for the inverted list.
  const items = [...(messages ?? [])].reverse();

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/groups'))}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          style={styles.headerButton}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        {group ? (
          <Pressable
            onPress={() => router.push({ pathname: '/group/[id]/info', params: { id } })}
            accessibilityRole="button"
            accessibilityLabel={`${group.name}, ${t('groups.about')}`}
            style={styles.headerTitle}>
            <GroupAvatar group={group} size={38} />
            <View style={styles.flex}>
              <View style={styles.inline}>
                {group.visibility === 'private' && <Lock size={12} color={colors.textMuted} />}
                <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
                  {group.name}
                </Text>
              </View>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {group.kind === 'channel' ? t('groups.channel') : t('groups.group')} · {t('common.members', { n: group.memberCount })}
              </Text>
            </View>
            <Info size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.flex} />
        )}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!group && loading ? (
          <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
        ) : (
          <FlatList
            data={items}
            inverted
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.messages}
            renderItem={({ item, index }) => {
              // In an inverted list the previous message in time is the next item.
              const previous = items[index + 1];
              const newDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
              return (
                <View>
                  {newDay && (
                    <View style={styles.day}>
                      <Text variant="caption" color="textSecondary">
                        {dayLabel(item.createdAt)}
                      </Text>
                    </View>
                  )}
                  <Bubble
                    message={item}
                    mine={isMine(item.author)}
                    showAuthor={group?.kind === 'group' && (newDay || previous?.author.id !== item.author.id)}
                    onLongPress={() => messageMenu(item)}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              member ? (
                <View style={styles.empty}>
                  <Text variant="callout" color="textMuted" align="center">
                    {t('groups.noMessages')}
                  </Text>
                </View>
              ) : group?.description ? (
                <View style={styles.empty}>
                  <Text variant="callout" color="textSecondary" align="center">
                    {group.description}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
        {group && <Composer group={group} />}
      </KeyboardAvoidingView>
    </View>
  );
}

export default requireAccount(GroupChatScreen, 'groups');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: gutter,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    backgroundColor: 'rgba(7,10,19,0.85)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messages: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  day: {
    alignSelf: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceStrong,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 5,
    gap: 1,
  },
  bubbleMine: {
    backgroundColor: colors.bubbleMine,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: colors.bubbleOther,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: colors.text,
  },
  time: {
    alignSelf: 'flex-end',
    fontSize: 10,
    color: colors.textMuted,
  },
  timeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  composerBar: {
    gap: spacing.sm,
    paddingHorizontal: gutter,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.text,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.45,
  },
});
