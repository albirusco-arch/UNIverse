import { router } from 'expo-router';
import { Eye, EyeOff, Hand, MapPin, ShieldCheck, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { BuddyCard } from '@/components/buddies';
import { useFeedback } from '@/components/feedback';
import { Button, Card, Chip, ChipScroller, DemoBadge, EmptyState, Header, IconTile, Screen, Text } from '@/components/ui';
import { countTravelBuddies, getUniversity, listTravelBuddies } from '@/data/api';
import type { Buddy, University } from '@/data/types';
import { t } from '@/i18n';
import { connection, filterBuddies, matchReasons, rankBuddies, type BuddyFilter } from '@/lib/buddies';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

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

/** Opt-in: students only see the list once they are visible too. */
function JoinCard({ destination, onJoin, busy }: { destination: University; onJoin: () => void; busy: boolean }) {
  const { data: count } = useQuery(countTravelBuddies, [destination.id]);
  const total = count?.total ?? 0;
  return (
    <Card tone="primary" style={styles.join}>
      <IconTile icon={Users} colors={gradients.primary} size={48} />
      <Text variant="title3" align="center">
        {total > 0
          ? t('buddies.joinCount', { n: total, university: destination.name })
          : t('buddies.joinFirst', { university: destination.name })}
      </Text>
      {count && count.sameTerm > 0 ? (
        <Text variant="callout" color="primaryPale" align="center">
          {t('buddies.joinSameTerm', { n: count.sameTerm })}
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

function BuddiesScreen() {
  const { profile, updateProfile } = useSession();
  const { showSheet, toast } = useFeedback();
  const { report, block } = useModeration();
  const [filter, setFilter] = useState<BuddyFilter>('all');
  const [saving, setSaving] = useState(false);
  const destination = getUniversity(profile.destinationId);

  const { data: buddies, refresh } = useQuery(
    () => (profile.discoverable ? listTravelBuddies() : Promise.resolve([] as Buddy[])),
    [profile.destinationId, profile.discoverable],
  );

  const setVisible = async (discoverable: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ discoverable });
      if (!discoverable) setFilter('all');
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

  const menu = (buddy: Buddy) =>
    showSheet({
      title: buddy.displayName,
      options: [
        { label: t('common.report'), onPress: () => report('user', buddy.id) },
        { label: t('common.block'), destructive: true, onPress: () => block(buddy, refresh) },
      ],
    });

  const header = (
    <Header
      title={t('buddies.title')}
      subtitle={destination ? `${flagEmoji(destination.countryCode)} ${destination.name}` : undefined}
      right={<DemoBadge />}
    />
  );

  if (!destination) {
    return (
      <Screen header={header}>
        <EmptyState
          icon={MapPin}
          text={t('buddies.noDestination')}
          action={<Button title={t('home.setUp')} size="sm" onPress={() => router.push('/onboarding?edit=1')} />}
        />
      </Screen>
    );
  }

  if (!profile.discoverable) {
    return (
      <Screen header={header}>
        <JoinCard destination={destination} onJoin={() => setVisible(true)} busy={saving} />
      </Screen>
    );
  }

  const ranked = rankBuddies(buddies ?? [], profile);
  const shown = filterBuddies(ranked, profile, filter);
  const waiting = ranked.filter((b) => connection(b) === 'incoming').length;
  const filters: { value: BuddyFilter; label: string }[] = [
    { value: 'all', label: t('buddies.filters.all') },
    ...(waiting > 0 ? [{ value: 'waves' as const, label: t('buddies.filters.waves', { n: waiting }) }] : []),
    ...(profile.term ? [{ value: 'term' as const, label: t('buddies.reasons.term') }] : []),
    ...(profile.field && profile.field !== 'other' ? [{ value: 'field' as const, label: t('buddies.reasons.field') }] : []),
    ...(profile.level ? [{ value: 'level' as const, label: t('buddies.reasons.level') }] : []),
  ];

  return (
    <Screen header={header}>
      <Card style={styles.visible}>
        <Eye size={18} color={colors.successLight} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('buddies.visibleTitle')}</Text>
          <Text variant="caption" color="textMuted">
            {t('buddies.visibleBody', { university: destination.name })}
          </Text>
        </View>
        <Switch
          value
          disabled={saving}
          onValueChange={(value) => (value ? undefined : hide())}
          trackColor={{ true: colors.primary, false: colors.surfaceStrong }}
          thumbColor="#FFFFFF"
          accessibilityLabel={t('buddies.visibleTitle')}
        />
      </Card>

      <View style={styles.filters}>
        <ChipScroller>
          {filters.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ChipScroller>
      </View>

      {shown.length > 0 ? (
        <View style={styles.list}>
          {shown.map((buddy) => (
            <BuddyCard key={buddy.id} buddy={buddy} reasons={matchReasons(buddy, profile)} onMenu={() => menu(buddy)} />
          ))}
        </View>
      ) : buddies ? (
        <EmptyState
          icon={Users}
          text={filter === 'all' ? t('buddies.empty', { university: destination.name }) : t('buddies.emptyFilter')}
        />
      ) : null}

      <Text variant="caption" color="textMuted" style={styles.safety}>
        {t('buddies.safety')}
      </Text>
    </Screen>
  );
}

export default requireAccount(BuddiesScreen, 'buddies');

const styles = StyleSheet.create({
  flex: {
    flex: 1,
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
  filters: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  safety: {
    marginTop: spacing.xl,
  },
});
