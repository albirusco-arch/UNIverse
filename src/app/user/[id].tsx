import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowRight, BadgeCheck, Briefcase, ExternalLink, Flag, Link2, SearchX, UserX } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Divider, EmptyState, Header, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import { getPublicProfile, getUniversity } from '@/data/api';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: student, loading } = useQuery(() => getPublicProfile(id), [id]);
  const { report, block, isMine } = useModeration();

  if (!student) {
    return (
      <Screen header={<Header title={t('user.title')} />}>
        {loading ? (
          <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
        ) : (
          <EmptyState icon={SearchX} text={t('common.error')} />
        )}
      </Screen>
    );
  }

  const destination = getUniversity(student.destinationId);
  const links = (
    [
      ['linkedin', student.linkedinUrl],
      ['handshake', student.handshakeUrl],
      ['jobteaser', student.jobteaserUrl],
    ] as const
  ).filter(([, url]) => url);
  const mine = isMine(student);

  return (
    <Screen header={<Header title={t('user.title')} />}>
      <View style={styles.hero}>
        <Avatar name={student.displayName} size={84} />
        <View style={styles.name}>
          <Text variant="title2">{student.displayName}</Text>
          {student.verified && <BadgeCheck size={20} color={colors.primaryLight} accessibilityLabel={t('community.verifiedStudent')} />}
        </View>
        <Text variant="callout" color="textSecondary" align="center">
          {[student.field ? t(`fields.${student.field}`) : null, student.level ? t(`levels.${student.level}`) : null, student.homeUniversity]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {student.openToOpportunities && <Badge icon={Briefcase} tone="success" label={t('user.openToWork')} />}
      </View>

      {destination && (
        <View style={styles.section}>
          <SectionHeader title={t('user.route')} />
          <Card
            onPress={() => router.push({ pathname: '/university/[id]', params: { id: destination.id } })}
            accessibilityLabel={destination.name}
            style={styles.route}>
            <Text variant="callout" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
              {student.homeUniversity || '—'}
            </Text>
            <ArrowRight size={16} color={colors.primaryLight} />
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
              {flagEmoji(destination.countryCode)} {destination.name}
            </Text>
          </Card>
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title={t('user.connect')} />
        {links.length > 0 ? (
          <Card style={styles.menu}>
            {links.map(([platform, url], index) => (
              <View key={platform}>
                {index > 0 && <Divider />}
                <ListRow
                  icon={platform === 'linkedin' ? Link2 : ExternalLink}
                  label={t(`career.platforms.${platform}`)}
                  onPress={() => WebBrowser.openBrowserAsync(url).catch(() => undefined)}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Text variant="callout" color="textMuted">
            {t('user.noLinks')}
          </Text>
        )}
      </View>

      {!mine && (
        <Card style={[styles.section, styles.menu]}>
          <ListRow icon={Flag} label={t('common.report')} onPress={() => report('user', student.id)} />
          <Divider />
          <ListRow icon={UserX} label={t('common.block')} destructive onPress={() => block(student, () => router.back())} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  name: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  section: {
    marginTop: spacing.xxl,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flexShrink: {
    flexShrink: 1,
  },
  menu: {
    padding: 0,
    overflow: 'hidden',
  },
});
