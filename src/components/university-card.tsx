import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeftRight, Bookmark, ChevronRight, MapPin, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScorePill, TopRatedBadge } from '@/components/score';
import { Badge, Text } from '@/components/ui';
import type { Region, University, UniversityScore, UniversityStats } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

/** Subtle per-region tint in the brand's blue→violet range. */
export const regionGradients: Record<Region, readonly [string, string]> = {
  europe: ['rgba(79,107,255,0.5)', 'rgba(7,10,19,0)'],
  uk: ['rgba(107,78,243,0.5)', 'rgba(7,10,19,0)'],
  north_america: ['rgba(91,141,239,0.45)', 'rgba(7,10,19,0)'],
  latin_america: ['rgba(163,91,245,0.42)', 'rgba(7,10,19,0)'],
  asia: ['rgba(176,92,242,0.45)', 'rgba(7,10,19,0)'],
  middle_east: ['rgba(128,184,248,0.35)', 'rgba(7,10,19,0)'],
  africa: ['rgba(52,211,153,0.3)', 'rgba(7,10,19,0)'],
  oceania: ['rgba(62,88,239,0.45)', 'rgba(7,10,19,0)'],
};

type Props = {
  university: University;
  stats?: UniversityStats;
  score?: UniversityScore;
  saved?: boolean;
};

export function UniversityCard({ university, stats, score, saved = false }: Props) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/university/[id]', params: { id: university.id } })}
      accessibilityRole="button"
      accessibilityLabel={[university.name, university.city, university.country].filter(Boolean).join(", ")}
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
            {saved && <Bookmark size={16} color={colors.primaryLight} fill={colors.primaryLight} />}
          </View>
          <View style={styles.location}>
            <MapPin size={13} color={colors.textMuted} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flexShrink}>
              {university.city ? `${university.city}, ` : ''}
              {university.country}
            </Text>
          </View>
          {(stats && (stats.members > 0 || stats.equivalences > 0)) || score ? (
            <View style={styles.stats}>
              <TopRatedBadge score={score} />
              {stats && stats.members > 0 && <Badge icon={Users} tone="primary" label={t('explore.members', { n: stats.members })} />}
              {stats && stats.equivalences > 0 && (
                <Badge icon={ArrowLeftRight} tone="success" label={t('explore.equivalences', { n: stats.equivalences })} />
              )}
            </View>
          ) : null}
        </View>
        {score?.score != null ? <ScorePill score={score} /> : <ChevronRight size={18} color={colors.textMuted} />}
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
  flexShrink: {
    flexShrink: 1,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
