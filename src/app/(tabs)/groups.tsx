import { router } from 'expo-router';
import { KeyRound, MessageCircle, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GroupRow } from '@/components/group-row';
import { Segmented } from '@/components/segmented';
import { Button, Card, Chip, ChipScroller, DemoBadge, EmptyState, IconButton, Input, Screen, Text } from '@/components/ui';
import { discoverGroups, listMyGroups, type DiscoverFilter } from '@/data/api';
import type { GroupKind } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

type Section = 'mine' | 'discover';
type Filter = 'all' | GroupKind | 'destination';

export default function GroupsTab() {
  const { profile } = useSession();
  const [view, setView] = useState<Section>('mine');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data: mine } = useQuery(listMyGroups, []);
  const discoverFilter: DiscoverFilter = {
    query,
    kind: filter === 'group' || filter === 'channel' ? filter : undefined,
    universityId: filter === 'destination' ? (profile.destinationId ?? undefined) : undefined,
  };
  const { data: discovered } = useQuery(
    () => (view === 'discover' ? discoverGroups(discoverFilter) : Promise.resolve([])),
    [view, query, filter, profile.destinationId],
  );

  const unread = mine?.reduce((sum, g) => sum + g.unreadCount, 0) ?? 0;
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('groups.all') },
    { value: 'group', label: t('groups.groupsFilter') },
    { value: 'channel', label: t('groups.channelsFilter') },
    ...(profile.destinationId ? [{ value: 'destination' as const, label: t('groups.myDestination') }] : []),
  ];

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text variant="title1" accessibilityRole="header">
            {t('groups.title')}
          </Text>
          <DemoBadge />
        </View>
        <View style={styles.actions}>
          <IconButton
            label={t('groups.joinWithCode')}
            onPress={() => router.push('/group/join')}
            icon={<KeyRound size={20} color={colors.text} />}
          />
          <IconButton
            label={t('groups.create')}
            onPress={() => router.push('/group/new')}
            icon={<Plus size={20} color={colors.text} />}
          />
        </View>
      </View>

      <View style={styles.segment}>
        <Segmented<Section>
          value={view}
          onChange={setView}
          options={[
            { value: 'mine', label: unread > 0 ? `${t('groups.mine')} · ${unread}` : t('groups.mine') },
            { value: 'discover', label: t('groups.discover') },
          ]}
        />
      </View>

      {view === 'mine' &&
        (mine && mine.length > 0 ? (
          <Card style={styles.list}>
            {mine.map((group) => (
              <GroupRow key={group.id} group={group} />
            ))}
          </Card>
        ) : mine ? (
          <EmptyState
            icon={MessageCircle}
            text={t('groups.emptyMine')}
            action={<Button title={t('groups.discover')} variant="secondary" size="sm" onPress={() => setView('discover')} />}
          />
        ) : null)}

      {view === 'discover' && (
        <View style={styles.discover}>
          <Input
            icon={Search}
            value={query}
            onChangeText={setQuery}
            placeholder={t('groups.searchPlaceholder')}
            autoCorrect={false}
            returnKeyType="search"
          />
          <ChipScroller>
            {filters.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ChipScroller>
          {discovered && discovered.length > 0 ? (
            <Card style={styles.list}>
              {discovered.map((group) => (
                <GroupRow key={group.id} group={group} />
              ))}
            </Card>
          ) : discovered ? (
            <EmptyState
              icon={Search}
              text={t('groups.emptyDiscover')}
              action={<Button title={t('groups.create')} icon={Plus} size="sm" onPress={() => router.push('/group/new')} />}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  list: {
    padding: spacing.xs,
  },
  discover: {
    gap: spacing.md,
  },
});
