import { Award, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Badge, Text } from '@/components/ui';
import type { UniversityScore } from '@/data/types';
import { t } from '@/i18n';
import { isTopRated, scoreTier, type ScoreTier } from '@/lib/scores';
import { useSvgId } from '@/lib/use-svg-id';
import { colors, radius, spacing } from '@/theme/tokens';

export const tierColors: Record<ScoreTier, string> = {
  excellent: colors.success,
  good: colors.primaryLight,
  fair: colors.amber,
  low: colors.red,
};

/** Circular gauge with the 0–100 score in the middle. */
export function ScoreRing({ score, size = 88 }: { score: number | null; size?: number }) {
  const id = useSvgId('score');
  const stroke = size * 0.1;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={score === null ? t('score.none') : `${score} / 100`}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#5B8DEF" />
            <Stop offset="0.6" stopColor="#6B4EF3" />
            <Stop offset="1" stopColor="#C46BF4" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceStrong} strokeWidth={stroke} fill="none" />
        {score !== null && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${id('ring')})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={{ color: colors.text, fontSize: size * 0.3, fontWeight: '800' }}>{score ?? '–'}</Text>
      </View>
    </View>
  );
}

/** Horizontal 0–100 bar for one part of the score. */
export function ScoreBar({ label, value, weight }: { label: string; value: number | null; weight?: string }) {
  return (
    <View style={styles.bar}>
      <View style={styles.barLabel}>
        <Text variant="caption" color="textSecondary">
          {label}
          {weight ? (
            <Text variant="caption" color="textMuted">
              {' '}
              {weight}
            </Text>
          ) : null}
        </Text>
        <Text variant="caption" color={value === null ? 'textMuted' : 'text'} style={styles.barValue}>
          {value ?? '–'}
        </Text>
      </View>
      <View style={styles.track}>
        {value !== null && (
          <View style={[styles.fill, { width: `${Math.max(3, value)}%`, backgroundColor: tierColors[scoreTier(value)] }]} />
        )}
      </View>
    </View>
  );
}

/** Compact score for cards and lists. */
export function ScorePill({ score }: { score: UniversityScore | undefined }) {
  if (!score || score.score === null) return null;
  const color = tierColors[scoreTier(score.score)];
  return (
    <View style={[styles.pill, { borderColor: color }]} accessibilityLabel={`${t('score.title')} ${score.score}`}>
      <Text variant="caption" style={{ color, fontWeight: '800' }}>
        {score.score}
      </Text>
    </View>
  );
}

export function TopRatedBadge({ score }: { score: UniversityScore | undefined }) {
  if (!isTopRated(score)) return null;
  return <Badge icon={Award} tone="success" label={t('score.topRated')} />;
}

/** Read-only stars (supports halves by rounding to the nearest 0.5). */
export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  const rounded = value === null ? 0 : Math.round(value * 2) / 2;
  return (
    <View style={styles.stars} accessibilityLabel={value === null ? t('score.none') : `${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = rounded >= n;
        const half = !filled && rounded >= n - 0.5;
        return (
          <View key={n} style={{ width: size, height: size }}>
            <Star size={size} color={colors.borderStrong} fill={colors.surfaceStrong} />
            {(filled || half) && (
              <View style={[StyleSheet.absoluteFill, { width: half ? size / 2 : size, overflow: 'hidden' }]}>
                <Star size={size} color={colors.amber} fill={colors.amber} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** 1–5 star picker for the rating form. */
export function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.starInput}>
      <Text variant="bodyStrong" style={styles.flex}>
        {label}
      </Text>
      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('rating.starsLabel', { dimension: label, n })}
            accessibilityState={{ selected: value === n }}>
            <Star size={30} color={n <= value ? colors.amber : colors.borderStrong} fill={n <= value ? colors.amber : 'transparent'} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    gap: 6,
  },
  barLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barValue: {
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceStrong,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  pill: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,10,19,0.6)',
  },
  stars: {
    flexDirection: 'row',
    gap: 3,
  },
  starInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
    minWidth: 120,
  },
});
