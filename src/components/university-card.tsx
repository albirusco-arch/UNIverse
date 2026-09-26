import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeftRight, Bookmark, ChevronRight, MapPin, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Text } from '@/components/ui';
import type { Region, University, UniversityStats } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

export const regionGradients: Record<Region, readonly [string, string]> = {
  europe: ['rgba(124,58,237,0.55)', 'rgba(15,23,42,0)'],
  uk: ['rgba(99,102,241,0.55)', 'rgba(15,23,42,0)'],
  north_america: ['rgba(13,148,136,0.55)', 'rgba(15,23,42,0)'],
  asia: ['rgba(168,85,247,0.55)', 'rgba(15,23,42,0)'],
  oceania: ['rgba(20,184,166,0.5)', 'rgba(15,23,42,0)'],
};

type Props = {
  university: University;
  stats?: UniversityStats;
  saved?: boolean;
};

export function UniversityCard({ university, stats, saved = false }: Props) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/university/[id]', params: { id: university.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${university.name}, ${university.city}, ${university.country}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <LinearGradient
        colors={regionGradients[university.region]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inner}>
        <View style={styles.flagTile}>
          <Text style={styles.flag}>{flagEmoji(university.countryCode)}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="title3" numberOfLines={2} style={styles.name}>
              {university.name}
            </Text>
            {saved && <Bookmark size={16} color={colors.violetLight} fill={colors.violetLight} />}
          </View>
          <View style={styles.location}>
            <MapPin size={13} color={colors.textMuted} />
            <Text variant="caption" color="textMuted">
              {university.city}, {university.country}
            </Text>
          </View>
          {stats && (stats.members > 0 || stats.equivalences > 0) ? (
            <View style={styles.stats}>
              {stats.members > 0 && <Badge icon={Users} tone="violet" label={t('explore.members', { n: stats.members })} />}
              {stats.equivalences > 0 && (
                <Badge icon={ArrowLeftRight} tone="teal" label={t('explore.equivalences', { n: stats.equivalences })} />
              )}
            </View>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  flagTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 28,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
