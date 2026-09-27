import { router, useLocalSearchParams } from 'expo-router';
import { MoreHorizontal, SearchX } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { hoursLeft, MomentImage, ReactionBar } from '@/components/moments';
import { Button, EmptyState, Header, IconButton, Screen, Text } from '@/components/ui';
import { deleteMoment, getMoment } from '@/data/api';
import { t } from '@/i18n';
import { timeAgo } from '@/lib/format';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

function MomentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: moment, loading } = useQuery(() => getMoment(id), [id]);
  const { report, block, isMine } = useModeration();
  const { showSheet, toast } = useFeedback();

  if (!moment) {
    return (
      <Screen header={<Header />}>
        {loading ? (
          <ActivityIndicator color={colors.textMuted} style={styles.loader} />
        ) : (
          <EmptyState icon={SearchX} text={t('moments.empty')} />
        )}
      </Screen>
    );
  }

  const clubId = moment.clubId;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/community'));

  const menu = () => {
    if (isMine(moment.author)) {
      showSheet({
        title: t('moments.delete'),
        message: t('moments.deleteConfirm'),
        options: [
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => {
              deleteMoment(moment.id)
                .then(close)
                .catch(() => toast(t('common.error')));
            },
          },
        ],
      });
      return;
    }
    showSheet({
      options: [
        { label: t('common.report'), onPress: () => report('moment', moment.id) },
        { label: t('common.block'), destructive: true, onPress: () => block(moment.author, close) },
      ],
    });
  };

  return (
    <Screen
      header={
        <Header
          title={moment.clubName ?? moment.author.displayName}
          subtitle={`${moment.author.displayName} · ${timeAgo(moment.createdAt)} · ${t('moments.hoursLeft', { n: hoursLeft(moment) })}`}
          right={
            <IconButton
              label={t('common.moreActions')}
              onPress={menu}
              icon={<MoreHorizontal size={20} color={colors.text} />}
            />
          }
        />
      }>
      <MomentImage moment={moment} style={styles.image} large />
      {moment.caption && moment.imageUrl ? (
        <Text variant="body" style={styles.caption}>
          {moment.caption}
        </Text>
      ) : null}
      <View style={styles.reactions}>
        <ReactionBar moment={moment} />
      </View>
      {clubId ? (
        <Button
          title={moment.clubName ?? t('moments.club')}
          variant="secondary"
          style={styles.club}
          onPress={() => router.push({ pathname: '/club/[id]', params: { id: clubId } })}
        />
      ) : null}
    </Screen>
  );
}

export default requireAccount(MomentScreen, 'moments');

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  caption: {
    marginTop: spacing.md,
  },
  reactions: {
    marginTop: spacing.lg,
  },
  club: {
    marginTop: spacing.xl,
  },
});
