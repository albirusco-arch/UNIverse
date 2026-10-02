import { router } from 'expo-router';
import { BadgeCheck, ChevronRight, Hand, MessageCircle, MoreHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Avatar, Badge, Button, Card, IconTile, Text } from '@/components/ui';
import { countTravelBuddies, getUniversity, listTravelBuddies, openDirectChat, RateLimitError, waveAt } from '@/data/api';
import type { Buddy } from '@/data/types';
import { t } from '@/i18n';
import { connection, type MatchReason } from '@/lib/buddies';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { termLabel } from '@/lib/terms';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

function BuddyAction({ buddy }: { buddy: Buddy }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const state = connection(buddy);
  const firstName = buddy.displayName.split(' ')[0];

  const wave = async () => {
    setBusy(true);
    try {
      await waveAt(buddy.id);
      toast(state === 'incoming' ? t('buddies.connected', { name: firstName }) : t('buddies.waveSent', { name: firstName }));
    } catch (error) {
      toast(error instanceof RateLimitError ? t('common.limit') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const chat = async () => {
    setBusy(true);
    try {
      const id = await openDirectChat(buddy);
      router.push({ pathname: '/group/[id]', params: { id } });
    } catch {
      toast(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  switch (state) {
    case 'connected':
      return <Button title={t('buddies.chat')} icon={MessageCircle} size="sm" loading={busy} onPress={chat} />;
    case 'incoming':
      return <Button title={t('buddies.waveBack')} icon={Hand} size="sm" loading={busy} onPress={wave} />;
    case 'waved':
      return <Button title={t('buddies.waved')} variant="secondary" size="sm" disabled />;
    default:
      return <Button title={t('buddies.wave')} icon={Hand} variant="secondary" size="sm" loading={busy} onPress={wave} />;
  }
}

/** A student going to the same destination: who they are, what you share, and the wave → chat button. */
export function BuddyCard({ buddy, reasons, onMenu }: { buddy: Buddy; reasons: MatchReason[]; onMenu: () => void }) {
  const home = getUniversity(buddy.homeUniversityId);
  const details = [
    buddy.field ? t(`fields.${buddy.field}`) : null,
    buddy.level ? t(`levels.${buddy.level}`) : null,
    buddy.term ? termLabel(buddy.term) : null,
  ].filter(Boolean);
  const incoming = connection(buddy) === 'incoming';

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Avatar name={buddy.displayName} size={48} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
              {buddy.displayName}
            </Text>
            {buddy.verified && <BadgeCheck size={14} color={colors.primaryLight} accessibilityLabel={t('profile.verified')} />}
          </View>
          <Text variant="callout" color="textSecondary" numberOfLines={1}>
            {home ? `${flagEmoji(home.countryCode)} ` : ''}
            {buddy.homeUniversity || '—'}
          </Text>
          {details.length > 0 && (
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {details.join(' · ')}
            </Text>
          )}
        </View>
        <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel={t('common.moreActions')} hitSlop={10}>
          <MoreHorizontal size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {(incoming || reasons.length > 0) && (
        <View style={styles.badges}>
          {incoming && <Badge tone="amber" icon={Hand} label={t('buddies.wavedAtYou')} />}
          {reasons.map((reason) => (
            <Badge key={reason} tone="primary" label={t(`buddies.reasons.${reason}`)} />
          ))}
        </View>
      )}
      <BuddyAction buddy={buddy} />
    </Card>
  );
}

/** Entry point on Home and in Groups: how many students go where you go, and new waves. */
export function BuddiesTeaser() {
  const { profile } = useSession();
  const destination = getUniversity(profile.destinationId);
  const { data: count } = useQuery(countTravelBuddies, [profile.destinationId, profile.term]);
  const { data: buddies } = useQuery(
    () => (profile.discoverable ? listTravelBuddies() : Promise.resolve([] as Buddy[])),
    [profile.destinationId, profile.discoverable],
  );
  if (!destination) return null;

  const waiting = (buddies ?? []).filter((b) => connection(b) === 'incoming').length;
  const total = count?.total ?? 0;
  const body = !profile.discoverable
    ? total > 0
      ? t('buddies.teaserHidden', { n: total, university: destination.name })
      : t('buddies.teaserEmpty', { university: destination.name })
    : total > 0
      ? t('buddies.teaserCount', { n: total, university: destination.name })
      : t('buddies.teaserEmpty', { university: destination.name });

  return (
    <Card onPress={() => router.push('/buddies')} accessibilityLabel={`${t('buddies.title')}. ${body}`} style={styles.teaser}>
      <IconTile icon={Hand} colors={gradients.primary} size={44} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{t('buddies.title')}</Text>
        <Text variant="callout" color="textSecondary">
          {body}
        </Text>
      </View>
      {waiting > 0 ? <Badge tone="amber" icon={Hand} label={t('buddies.newWaves', { n: waiting })} /> : <ChevronRight size={18} color={colors.textMuted} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  card: {
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
