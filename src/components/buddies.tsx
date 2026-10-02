import { router } from 'expo-router';
import { BadgeCheck, ChevronRight, Eye, EyeOff, Hand, MessageCircle, MoreHorizontal, ShieldCheck, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Avatar, Badge, Button, Card, IconTile, Text } from '@/components/ui';
import { countTravelBuddies, getUniversity, listTravelBuddies, openDirectChat, RateLimitError, waveAt } from '@/data/api';
import type { Buddy } from '@/data/types';
import { t } from '@/i18n';
import { connection, type MatchReason } from '@/lib/buddies';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { termLabel } from '@/lib/terms';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

/** One visibility setting for travel buddies and the campus (profiles.discoverable). */
export function useVisibility() {
  const { profile, updateProfile } = useSession();
  const { showSheet, toast } = useFeedback();
  const [saving, setSaving] = useState(false);

  const setVisible = async (discoverable: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ discoverable });
    } catch {
      toast(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const hide = () =>
    showSheet({
      title: t('buddies.hideTitle'),
      message: t('buddies.hideBody'),
      options: [{ label: t('buddies.hide'), destructive: true, onPress: () => setVisible(false) }],
    });

  return { visible: profile.discoverable, saving, show: () => setVisible(true), hide };
}

/** Report or block a student from their card. */
export function usePersonMenu(onBlocked: () => void) {
  const { showSheet } = useFeedback();
  const { report, block } = useModeration();
  return (person: Buddy) =>
    showSheet({
      title: person.displayName,
      options: [
        { label: t('common.report'), onPress: () => report('user', person.id) },
        { label: t('common.block'), destructive: true, onPress: () => block(person, onBlocked) },
      ],
    });
}

function Point({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <View style={styles.point}>
      <Icon size={16} color={colors.primaryLight} strokeWidth={2.2} />
      <Text variant="callout" color="textSecondary" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

/** Opt-in: students only see each other once they are visible too. */
export function JoinCard({ title, subtitle, onJoin, busy }: { title: string; subtitle?: string; onJoin: () => void; busy: boolean }) {
  return (
    <Card tone="primary" style={styles.join}>
      <IconTile icon={Users} colors={gradients.primary} size={48} />
      <Text variant="title3" align="center">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="callout" color="primaryPale" align="center">
          {subtitle}
        </Text>
      ) : null}
      <Text variant="callout" color="textSecondary" align="center">
        {t('buddies.joinBody')}
      </Text>
      <View style={styles.points}>
        <Point icon={ShieldCheck} text={t('buddies.privacyShown')} />
        <Point icon={EyeOff} text={t('buddies.privacyHidden')} />
        <Point icon={Hand} text={t('buddies.privacyWaves')} />
      </View>
      <Button title={t('buddies.becomeVisible')} icon={Eye} loading={busy} onPress={onJoin} style={styles.joinButton} />
    </Card>
  );
}

/** "You are visible", with the switch to hide again. */
export function VisibleCard({ body, saving, onHide }: { body: string; saving: boolean; onHide: () => void }) {
  return (
    <Card style={styles.visible}>
      <Eye size={18} color={colors.successLight} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{t('buddies.visibleTitle')}</Text>
        <Text variant="caption" color="textMuted">
          {body}
        </Text>
      </View>
      <Switch
        value
        disabled={saving}
        onValueChange={(value) => (value ? undefined : onHide())}
        trackColor={{ true: colors.primary, false: colors.surfaceStrong }}
        thumbColor="#FFFFFF"
        accessibilityLabel={t('buddies.visibleTitle')}
      />
    </Card>
  );
}

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

/** A student on your path: who they are, what you share, and the wave → chat button. */
export function BuddyCard({
  buddy,
  reasons,
  tag,
  onMenu,
}: {
  buddy: Buddy;
  reasons: MatchReason[];
  /** Shown first, e.g. "CBS student" or "Exchange · Fall 2026" on the campus. */
  tag?: string;
  onMenu: () => void;
}) {
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
      {(incoming || reasons.length > 0 || tag) && (
        <View style={styles.badges}>
          {tag ? <Badge tone="neutral" label={tag} /> : null}
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
  join: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    marginTop: spacing.md,
  },
  points: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  joinButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  visible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
