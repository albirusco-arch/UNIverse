import { router, useLocalSearchParams } from 'expo-router';
import { Lock, PartyPopper, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { BuddyCard, JoinCard, usePersonMenu, useVisibility, VisibleCard } from '@/components/buddies';
import { PlanCard } from '@/components/campus';
import { useFeedback } from '@/components/feedback';
import { Segmented } from '@/components/segmented';
import { Button, Chip, ChipScroller, DemoBadge, EmptyState, Header, Screen, Text } from '@/components/ui';
import {
  countCampusPeople,
  deletePlan,
  getUniversity,
  leavePlan,
  listCampusPeople,
  listLaunchCampuses,
  listPlans,
} from '@/data/api';
import type { Buddy, Plan } from '@/data/types';
import { t } from '@/i18n';
import { matchReasons, rankBuddies } from '@/lib/buddies';
import { campusRole, filterCampusPeople, upcomingPlans, type CampusFilter } from '@/lib/campus';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { termLabel } from '@/lib/terms';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

type Section = 'plans' | 'people';

function PlansSection({ campusId }: { campusId: string }) {
  const { showSheet, toast } = useFeedback();
  const { report, block, isMine } = useModeration();
  const { data: plans, refresh } = useQuery(() => listPlans(campusId), [campusId]);
  const live = upcomingPlans(plans ?? []);

  const menu = (plan: Plan) => {
    if (isMine(plan.author)) {
      showSheet({
        title: t('campus.deletePlan'),
        message: t('campus.deleteConfirm'),
        options: [
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => {
              deletePlan(plan.id).catch(() => toast(t('common.error')));
            },
          },
        ],
      });
      return;
    }
    showSheet({
      title: plan.title,
      options: [
        ...(plan.joinedByMe
          ? [
              {
                label: t('campus.leavePlan'),
                onPress: () => {
                  leavePlan(plan.id).catch(() => toast(t('common.error')));
                },
              },
            ]
          : []),
        { label: t('campus.reportPlan'), onPress: () => report('plan', plan.id) },
        { label: t('common.block'), destructive: true, onPress: () => block(plan.author, refresh) },
      ],
    });
  };

  return (
    <View style={styles.section}>
      <Button
        title={t('campus.propose')}
        icon={Plus}
        onPress={() => router.push({ pathname: '/plan/new', params: { campus: campusId } })}
      />
      {live.length > 0 ? (
        <View style={styles.list}>
          {live.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onMenu={() => menu(plan)} />
          ))}
        </View>
      ) : plans ? (
        <EmptyState icon={PartyPopper} text={t('campus.noPlans')} />
      ) : (
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      )}
      <Text variant="caption" color="textMuted">
        {t('campus.planSafety')}
      </Text>
    </View>
  );
}

function PeopleSection({ campusId, name }: { campusId: string; name: string }) {
  const { profile } = useSession();
  const { visible, saving, show, hide } = useVisibility();
  const [filter, setFilter] = useState<CampusFilter>('all');
  const { data: count } = useQuery(() => countCampusPeople(campusId), [campusId]);
  const { data: people, refresh } = useQuery(
    () => (visible ? listCampusPeople(campusId) : Promise.resolve([] as Buddy[])),
    [campusId, visible],
  );
  const menu = usePersonMenu(refresh);

  if (!visible) {
    const total = count?.total ?? 0;
    return (
      <JoinCard
        title={total > 0 ? t('campus.joinCount', { n: total, university: name }) : t('campus.joinFirst', { university: name })}
        subtitle={count && count.incoming > 0 ? t('campus.joinIncoming', { n: count.incoming }) : undefined}
        onJoin={show}
        busy={saving}
      />
    );
  }

  const shown = filterCampusPeople(rankBuddies(people ?? [], profile), campusId, filter);
  const filters: { value: CampusFilter; label: string }[] = [
    { value: 'all', label: t('campus.filters.all') },
    { value: 'here', label: t('campus.filters.here') },
    { value: 'local', label: t('campus.filters.local') },
    { value: 'incoming', label: t('campus.filters.incoming') },
  ];
  const tag = (person: Buddy) =>
    campusRole(person, campusId) === 'local'
      ? t('campus.localTag')
      : person.term
        ? t('campus.incomingTag', { term: termLabel(person.term) })
        : t('campus.incomingTagNoTerm');

  return (
    <View>
      <VisibleCard body={t('campus.visibleBody', { university: name })} saving={saving} onHide={hide} />
      <View style={styles.filters}>
        <ChipScroller>
          {filters.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ChipScroller>
      </View>
      {shown.length > 0 ? (
        <View style={styles.list}>
          {shown.map((person) => {
            // A local's semester is their own exchange elsewhere: not shown, and not a match.
            const card = campusRole(person, campusId) === 'local' ? { ...person, term: null } : person;
            return (
              <BuddyCard
                key={person.id}
                buddy={card}
                tag={tag(person)}
                reasons={matchReasons(card, profile)}
                onMenu={() => menu(person)}
              />
            );
          })}
        </View>
      ) : people ? (
        <EmptyState icon={Users} text={filter === 'all' ? t('campus.empty') : t('buddies.emptyFilter')} />
      ) : null}
      <Text variant="caption" color="textMuted" style={styles.safety}>
        {t('buddies.safety')}
      </Text>
    </View>
  );
}

function CampusScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const { profile } = useSession();
  const [view, setView] = useState<Section>(section === 'people' ? 'people' : 'plans');
  const { data: launched } = useQuery(listLaunchCampuses, []);
  const university = getUniversity(id);
  const name = university?.name ?? id;

  const header = (
    <Header
      title={name}
      subtitle={university ? `${flagEmoji(university.countryCode)} ${t('campus.subtitle')}` : t('campus.subtitle')}
      right={<DemoBadge />}
    />
  );

  if (!launched) {
    return (
      <Screen header={header}>
        <ActivityIndicator color={colors.primaryLight} style={styles.loader} />
      </Screen>
    );
  }

  const member = launched.includes(id) && (profile.homeUniversityId === id || profile.destinationId === id);
  if (!member) {
    return (
      <Screen header={header}>
        <EmptyState
          icon={Lock}
          text={launched.includes(id) ? t('campus.notMember', { university: name }) : t('campus.notLaunched', { university: name })}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <View style={styles.segment}>
        <Segmented<Section>
          value={view}
          onChange={setView}
          options={[
            { value: 'plans', label: t('campus.plans') },
            { value: 'people', label: t('campus.people') },
          ]}
        />
      </View>
      {view === 'plans' ? <PlansSection campusId={id} /> : <PeopleSection campusId={id} name={name} />}
    </Screen>
  );
}

export default requireAccount(CampusScreen, 'campus');

const styles = StyleSheet.create({
  segment: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  section: {
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  loader: {
    marginTop: spacing.xxl,
  },
  filters: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  safety: {
    marginTop: spacing.xl,
  },
});
