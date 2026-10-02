import { router } from 'expo-router';
import { MapPin, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { BuddyCard, JoinCard, usePersonMenu, useVisibility, VisibleCard } from '@/components/buddies';
import { Button, Chip, ChipScroller, DemoBadge, EmptyState, Header, Screen, Text } from '@/components/ui';
import { countTravelBuddies, getUniversity, listTravelBuddies } from '@/data/api';
import type { Buddy } from '@/data/types';
import { t } from '@/i18n';
import { connection, filterBuddies, matchReasons, rankBuddies, type BuddyFilter } from '@/lib/buddies';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { spacing } from '@/theme/tokens';

function BuddiesScreen() {
  const { profile } = useSession();
  const { visible, saving, show, hide } = useVisibility();
  const [filter, setFilter] = useState<BuddyFilter>('all');
  const destination = getUniversity(profile.destinationId);

  const { data: count } = useQuery(countTravelBuddies, [profile.destinationId, profile.term]);
  const { data: buddies, refresh } = useQuery(
    () => (visible ? listTravelBuddies() : Promise.resolve([] as Buddy[])),
    [profile.destinationId, visible],
  );
  const menu = usePersonMenu(refresh);

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

  if (!visible) {
    const total = count?.total ?? 0;
    return (
      <Screen header={header}>
        <JoinCard
          title={
            total > 0
              ? t('buddies.joinCount', { n: total, university: destination.name })
              : t('buddies.joinFirst', { university: destination.name })
          }
          subtitle={count && count.sameTerm > 0 ? t('buddies.joinSameTerm', { n: count.sameTerm }) : undefined}
          onJoin={show}
          busy={saving}
        />
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
      <VisibleCard body={t('buddies.visibleBody', { university: destination.name })} saving={saving} onHide={hide} />

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
