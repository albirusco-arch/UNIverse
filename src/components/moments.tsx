import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Badge, Text } from '@/components/ui';
import { reactToMoment } from '@/data/api';
import { MOMENT_REACTIONS, type Moment, type MomentReaction } from '@/data/types';
import { t } from '@/i18n';
import { MOMENT_TTL_HOURS, reactionTotal } from '@/lib/moments';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

/** Muted tints for demo samples, which have no photo. */
const TINTS = ['#1B2340', '#2A1E3F', '#14302B', '#33261A', '#1E2B3A'];

function tintFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

export function hoursLeft(moment: Pick<Moment, 'createdAt'>): number {
  const elapsed = (Date.now() - new Date(moment.createdAt).getTime()) / 3600_000;
  return Math.max(1, Math.ceil(MOMENT_TTL_HOURS - elapsed));
}

/** The photo, or for demo samples a tinted tile with the caption. */
export function MomentImage({
  moment,
  style,
  large = false,
}: {
  moment: Moment;
  style?: StyleProp<ViewStyle>;
  /** Full-size viewer: bigger caption on sample tiles. */
  large?: boolean;
}) {
  if (moment.imageUrl) {
    return (
      <View style={[styles.imageBox, style]}>
        <Image
          source={{ uri: moment.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityLabel={moment.caption || moment.clubName || t('moments.title')}
        />
      </View>
    );
  }
  return (
    <View style={[styles.imageBox, styles.placeholder, { backgroundColor: tintFor(moment.id) }, style]}>
      <View>
        <Badge label={t('moments.example')} />
      </View>
      <Text
        variant={large ? 'title3' : 'caption'}
        align="center"
        numberOfLines={large ? undefined : 4}
        style={styles.placeholderText}>
        {moment.caption.replace(/^Example — /, '')}
      </Text>
    </View>
  );
}

function topReaction(moment: Moment): MomentReaction {
  return MOMENT_REACTIONS.reduce((best, emoji) =>
    (moment.reactions[emoji] ?? 0) > (moment.reactions[best] ?? 0) ? emoji : best,
  );
}

/** Portrait thumbnail used in rails and grids. */
export const MomentTile = memo(function MomentTile({ moment, width = 112 }: { moment: Moment; width?: number }) {
  const total = reactionTotal(moment);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/moment/[id]', params: { id: moment.id } })}
      accessibilityRole="button"
      accessibilityLabel={[moment.clubName, moment.caption].filter(Boolean).join(', ')}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}>
      <View>
        <MomentImage moment={moment} style={{ width, height: width * (4 / 3) }} />
        {total > 0 ? (
          <View style={styles.count}>
            <Text variant="caption" style={styles.countText}>
              {topReaction(moment)} {total}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tileMeta}>
        <Text variant="caption" numberOfLines={1}>
          {moment.clubName ?? moment.author.displayName}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {t('moments.hoursLeft', { n: hoursLeft(moment) })}
        </Text>
      </View>
    </Pressable>
  );
});

/** Horizontal rail of live moments, starting with a "post a moment" tile. */
export function MomentsRail({ moments, onPost }: { moments: Moment[]; onPost?: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent}>
      {onPost ? (
        <Pressable
          onPress={onPost}
          accessibilityRole="button"
          accessibilityLabel={t('moments.new')}
          style={({ pressed }) => [styles.postTile, pressed && { backgroundColor: colors.surfacePressed }]}>
          <Plus size={22} color={colors.text} />
          <Text variant="caption" align="center">
            {t('moments.new')}
          </Text>
        </Pressable>
      ) : null}
      {moments.map((moment) => (
        <MomentTile key={moment.id} moment={moment} />
      ))}
    </ScrollView>
  );
}

/** One emoji reaction per student; tapping the chosen one again removes it. */
export function ReactionBar({ moment }: { moment: Moment }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);

  const react = async (emoji: MomentReaction) => {
    if (busy) return;
    setBusy(true);
    try {
      await reactToMoment(moment.id, moment.myReaction === emoji ? null : emoji);
    } catch {
      toast(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.reactions}>
      {MOMENT_REACTIONS.map((emoji) => {
        const selected = moment.myReaction === emoji;
        const n = moment.reactions[emoji] ?? 0;
        return (
          <Pressable
            key={emoji}
            onPress={() => react(emoji)}
            accessibilityRole="button"
            accessibilityLabel={t('moments.react', { emoji })}
            accessibilityState={{ selected }}
            hitSlop={4}
            style={({ pressed }) => [styles.reaction, selected && styles.reactionSelected, pressed && { opacity: 0.8 }]}>
            <Text style={styles.emoji}>{emoji}</Text>
            {n > 0 ? (
              <Text variant="caption" color={selected ? 'text' : 'textSecondary'}>
                {n}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  imageBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  placeholderText: {
    maxWidth: 280,
    color: colors.text,
  },
  count: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  countText: {
    color: colors.text,
  },
  tileMeta: {
    marginTop: 6,
    gap: 1,
  },
  rail: {
    marginHorizontal: -gutter,
  },
  railContent: {
    paddingHorizontal: gutter,
    gap: spacing.sm,
  },
  postTile: {
    width: 112,
    height: 112 * (4 / 3),
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reactionSelected: {
    borderColor: colors.text,
    backgroundColor: colors.surfaceStrong,
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
});
