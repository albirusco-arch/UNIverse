import { router, useLocalSearchParams } from 'expo-router';
import { Ban, Flag, GraduationCap, LogOut, SearchX, Share2 } from 'lucide-react-native';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { GroupAvatar } from '@/components/group-row';
import { Badge, Card, EmptyState, Header, ListRow, Screen, Text } from '@/components/ui';
import { getGroup, getUniversity, leaveGroup } from '@/data/api';
import { t } from '@/i18n';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group, loading } = useQuery(() => getGroup(id), [id]);
  const { showSheet, toast } = useFeedback();
  const { report, block } = useModeration();

  if (!group) {
    return (
      <Screen header={<Header title={t('groups.about')} />}>
        {loading ? (
          <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
        ) : (
          <EmptyState icon={SearchX} text={t('common.error')} />
        )}
      </Screen>
    );
  }

  if (group.kind === 'direct' && group.peerId) {
    const peer = {
      id: group.peerId,
      displayName: group.name,
      homeUniversity: group.description,
      field: null,
      destinationId: null,
      verified: true,
    };
    return (
      <Screen header={<Header title={t('groups.direct')} />}>
        <View style={styles.hero}>
          <GroupAvatar group={group} size={84} />
          <Text variant="title2" align="center">
            {group.name}
          </Text>
          {group.description ? (
            <Text variant="body" color="textSecondary" align="center">
              {group.description}
            </Text>
          ) : null}
        </View>
        <Card style={styles.actions}>
          <ListRow icon={Flag} label={t('groups.reportStudent')} onPress={() => report('user', peer.id)} />
          <ListRow icon={Ban} label={t('common.block')} destructive onPress={() => block(peer, () => router.dismissTo('/groups'))} />
        </Card>
        <Text variant="caption" color="textMuted" style={styles.note}>
          {t('groups.directNote')}
        </Text>
      </Screen>
    );
  }

  const university = getUniversity(group.universityId);

  const share = () => {
    if (!group.inviteCode) return;
    Share.share({ message: t('groups.inviteShare', { name: group.name, code: group.inviteCode }) }).catch(() => undefined);
  };

  const leave = () =>
    showSheet({
      title: t('groups.leave'),
      message: t('groups.leaveConfirm'),
      options: [
        {
          label: t('groups.leave'),
          destructive: true,
          onPress: () => {
            leaveGroup(group.id)
              .then(() => router.dismissTo('/groups'))
              .catch(() => toast(t('common.error')));
          },
        },
      ],
    });

  return (
    <Screen header={<Header title={t('groups.about')} />}>
      <View style={styles.hero}>
        <GroupAvatar group={group} size={84} />
        <Text variant="title2" align="center">
          {group.name}
        </Text>
        <View style={styles.badges}>
          <Badge label={group.kind === 'channel' ? t('groups.channel') : t('groups.group')} tone={group.kind === 'channel' ? 'accent' : 'primary'} />
          <Badge label={group.visibility === 'private' ? t('groups.private') : t('groups.public')} tone="neutral" />
          <Badge label={t('common.members', { n: group.memberCount })} tone="neutral" />
        </View>
        {group.description ? (
          <Text variant="body" color="textSecondary" align="center">
            {group.description}
          </Text>
        ) : null}
      </View>

      {group.inviteCode && (
        <Card style={styles.invite}>
          <Text variant="overline" color="textMuted" style={styles.inviteLabel}>
            {t('groups.inviteCode')}
          </Text>
          <Text style={styles.code} selectable accessibilityLabel={group.inviteCode.split('').join(' ')}>
            {group.inviteCode}
          </Text>
          <ListRow icon={Share2} label={t('common.share')} onPress={share} />
        </Card>
      )}

      <Card style={styles.actions}>
        {university && (
          <ListRow
            icon={GraduationCap}
            label={university.name}
            onPress={() => router.push({ pathname: '/university/[id]', params: { id: university.id } })}
          />
        )}
        <ListRow icon={Flag} label={t('groups.reportGroup')} onPress={() => report('group', group.id)} />
        {group.myRole !== null && group.myRole !== 'owner' && (
          <ListRow icon={LogOut} label={t('groups.leave')} destructive onPress={leave} />
        )}
      </Card>
    </Screen>
  );
}

export default requireAccount(GroupInfoScreen, 'groups');

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  invite: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  inviteLabel: {
    paddingHorizontal: spacing.lg,
  },
  code: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
    paddingHorizontal: spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  note: {
    marginTop: spacing.lg,
  },
  actions: {
    marginTop: spacing.lg,
    padding: 0,
    overflow: 'hidden',
    borderRadius: radius.xl,
  },
});
