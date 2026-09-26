import { router } from 'expo-router';
import {
  BookOpen,
  Code,
  Globe2,
  HandHeart,
  Music,
  Palette,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, IconTile, Text } from '@/components/ui';
import type { Club, ClubCategory } from '@/data/types';
import { t } from '@/i18n';
import { gradients, spacing } from '@/theme/tokens';

export const clubIcons: Record<ClubCategory, LucideIcon> = {
  international: Globe2,
  academic: BookOpen,
  culture: Music,
  sports: Trophy,
  tech: Code,
  volunteering: HandHeart,
  arts: Palette,
  other: Users,
};

export function ClubSourceBadge({ club }: { club: Club }) {
  if (club.verified) return <Badge icon={ShieldCheck} tone="success" label={t('clubs.verified')} />;
  if (club.source === 'ai') return <Badge icon={Sparkles} tone="primary" label={t('clubs.foundByAi')} />;
  return <Badge icon={UserRound} tone="neutral" label={t('clubs.community')} />;
}

export function ClubCard({ club }: { club: Club }) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/club/[id]', params: { id: club.id } })}
      accessibilityLabel={club.name}
      style={styles.card}>
      <IconTile icon={clubIcons[club.category]} colors={club.category === 'international' ? gradients.primary : gradients.accent} size={44} />
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {club.name}
        </Text>
        {club.description ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {club.description}
          </Text>
        ) : null}
        <View style={styles.badges}>
          <Badge label={t(`clubs.categories.${club.category}`)} tone="accent" />
          <ClubSourceBadge club={club} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
