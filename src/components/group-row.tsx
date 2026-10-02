import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Lock, Megaphone, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Text } from '@/components/ui';
import type { Group } from '@/data/types';
import { t } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { colors, gradients, radius, spacing } from '@/theme/tokens';

export function GroupAvatar({ group, size = 48 }: { group: Pick<Group, 'kind' | 'name'>; size?: number }) {
  if (group.kind === 'direct') return <Avatar name={group.name} size={size} />;
  const Icon = group.kind === 'channel' ? Megaphone : Users;
  return (
    <LinearGradient
      colors={group.kind === 'channel' ? gradients.accent : gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.42} color="#FFFFFF" strokeWidth={2} />
    </LinearGradient>
  );
}

/** Chat-list row: last message and unread count for members, description and size otherwise. */
export function GroupRow({ group }: { group: Group }) {
  const member = group.myRole !== null;
  const subtitle = member && group.lastMessagePreview ? group.lastMessagePreview : group.description;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={group.unreadCount ? `${group.name}, ${t('common.unread', { n: group.unreadCount })}` : group.name}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      <GroupAvatar group={group} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.name}>
            {group.visibility === 'private' && group.kind !== 'direct' && <Lock size={12} color={colors.textMuted} />}
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
              {group.name}
            </Text>
          </View>
          {member && group.lastMessageAt ? (
            <Text variant="caption" color={group.unreadCount > 0 ? 'primaryLight' : 'textMuted'}>
              {timeAgo(group.lastMessageAt)}
            </Text>
          ) : null}
        </View>
        <View style={styles.titleRow}>
          <Text variant="callout" color="textMuted" numberOfLines={1} style={styles.flexShrink}>
            {subtitle || t('common.members', { n: group.memberCount })}
          </Text>
          {group.unreadCount > 0 ? (
            <View style={styles.unread}>
              <Text variant="caption" style={styles.unreadText}>
                {group.unreadCount > 99 ? '99+' : group.unreadCount}
              </Text>
            </View>
          ) : !member ? (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.noShrink}>
              {t('common.members', { n: group.memberCount })}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
});
