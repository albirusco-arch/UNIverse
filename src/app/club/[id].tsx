import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AtSign, ExternalLink, Flag, Link2, MessageCircle, SearchX } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useRequireAccount } from '@/components/account-gate';
import { clubIcons, ClubSourceBadge } from '@/components/club-card';
import { useFeedback } from '@/components/feedback';
import { Badge, Button, Card, EmptyState, Header, IconTile, ListRow, Screen, Text } from '@/components/ui';
import { getClub, getUniversity, openClubGroup, reportContent } from '@/data/api';
import type { ReportReason } from '@/data/types';
import { t } from '@/i18n';
import { hostname } from '@/lib/format';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

const REASONS: ReportReason[] = ['spam', 'harassment', 'misinformation', 'inappropriate'];

function instagramUrl(handle: string): string {
  if (/^https?:\/\//.test(handle)) return handle;
  return `https://www.instagram.com/${handle.replace(/^@/, '')}`;
}

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: club, loading } = useQuery(() => getClub(id), [id]);
  const { showSheet, toast } = useFeedback();
  const [opening, setOpening] = useState(false);
  const requireAccount = useRequireAccount();

  if (!club) {
    return (
      <Screen header={<Header />}>
        {loading ? (
          <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
        ) : (
          <EmptyState icon={SearchX} text={t('common.error')} />
        )}
      </Screen>
    );
  }

  const university = getUniversity(club.universityId);

  const openChat = () =>
    requireAccount('clubs', async () => {
      setOpening(true);
      try {
        const groupId = await openClubGroup(club.id, club.name);
        router.push({ pathname: '/group/[id]', params: { id: groupId } });
      } catch {
        toast(t('common.error'));
      } finally {
        setOpening(false);
      }
    });

  const report = () =>
    requireAccount('clubs', () =>
      showSheet({
        title: t('community.reportTitle'),
        message: t('community.reportBody'),
        options: REASONS.map((reason) => ({
          label: t(`community.reportReasons.${reason}`),
          onPress: () => {
            reportContent('club', club.id, reason)
              .then(() => toast(t('community.reported')))
              .catch(() => toast(t('common.error')));
          },
        })),
      }),
    );

  return (
    <Screen
      header={<Header title={club.name} subtitle={university?.name} />}
      footer={<Button title={t('clubs.openChat')} icon={MessageCircle} onPress={openChat} loading={opening} />}>
      <View style={styles.hero}>
        <IconTile icon={clubIcons[club.category]} colors={club.category === 'international' ? gradients.primary : gradients.accent} size={72} />
        <Text variant="title1" align="center">
          {club.name}
        </Text>
        <View style={styles.badges}>
          <Badge label={t(`clubs.categories.${club.category}`)} tone="accent" />
          <ClubSourceBadge club={club} />
        </View>
        {club.description ? (
          <Text variant="body" color="textSecondary" align="center">
            {club.description}
          </Text>
        ) : null}
      </View>

      <Card style={styles.links}>
        {club.website ? (
          <ListRow
            icon={Link2}
            label={t('clubs.website')}
            value={hostname(club.website)}
            onPress={() => WebBrowser.openBrowserAsync(club.website)}
          />
        ) : null}
        {club.instagram ? (
          <ListRow
            icon={AtSign}
            label={t('clubs.instagram')}
            value={club.instagram}
            onPress={() => WebBrowser.openBrowserAsync(instagramUrl(club.instagram))}
          />
        ) : null}
        {club.sourceUrl ? (
          <ListRow
            icon={ExternalLink}
            label={t('clubs.source')}
            value={hostname(club.sourceUrl)}
            onPress={() => WebBrowser.openBrowserAsync(club.sourceUrl)}
          />
        ) : null}
        <ListRow icon={Flag} label={t('common.report')} onPress={report} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  links: {
    padding: 0,
    overflow: 'hidden',
    marginTop: spacing.xxl,
  },
});
