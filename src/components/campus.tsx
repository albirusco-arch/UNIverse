import { router } from 'expo-router';
import { ChevronRight, Clock, MapPin, MessageCircle, MoreHorizontal, PartyPopper, Share2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Avatar, Badge, Button, Card, IconTile, Text } from '@/components/ui';
import { getUniversity, joinPlan, listLaunchCampuses, listPlans } from '@/data/api';
import type { Plan } from '@/data/types';
import { locale, t } from '@/i18n';
import { campusFor, planDay, upcomingPlans } from '@/lib/campus';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, spacing } from '@/theme/tokens';

/** "Today 19:00", "Tomorrow 12:00", "Happening now". */
export function planWhen(startsAt: string | Date, soon = false): string {
  const date = new Date(startsAt);
  const time = date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (soon) return t('campus.soon', { time });
  switch (planDay(date.toISOString())) {
    case 'now':
      return t('campus.happeningNow');
    case 'today':
      return t('campus.today', { time });
    case 'tomorrow':
      return t('campus.tomorrow', { time });
    default:
      return `${formatDate(date.toISOString())} ${time}`;
  }
}

function openChat(groupId: string) {
  router.push({ pathname: '/group/[id]', params: { id: groupId } });
}

/** A plan: when, what, where, who is going, and join → the plan's chat. */
export function PlanCard({ plan, onMenu }: { plan: Plan; onMenu: () => void }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const now = planDay(plan.startsAt) === 'now';

  const join = async () => {
    setBusy(true);
    try {
      const chat = await joinPlan(plan.id);
      toast(t('campus.joined'));
      if (chat) openChat(chat);
    } catch {
      toast(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.plan}>
      <View style={styles.planTop}>
        <Badge tone={now ? 'success' : 'primary'} icon={Clock} label={planWhen(plan.startsAt)} />
        <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel={t('common.moreActions')} hitSlop={10}>
          <MoreHorizontal size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text variant="title3">{plan.title}</Text>
      <View style={styles.line}>
        <MapPin size={14} color={colors.textMuted} />
        <Text variant="callout" color="textSecondary" style={styles.flex}>
          {plan.place}
        </Text>
      </View>
      <View style={styles.line}>
        <Avatar name={plan.author.displayName} size={24} />
        <Text variant="caption" color="textMuted" style={styles.flex} numberOfLines={1}>
          {t('campus.by', { name: plan.author.displayName })} · {t('campus.going', { n: plan.memberCount })}
        </Text>
      </View>
      {plan.joinedByMe ? (
        <Button
          title={t('campus.openChat')}
          icon={MessageCircle}
          variant="secondary"
          size="sm"
          disabled={!plan.groupId}
          onPress={() => plan.groupId && openChat(plan.groupId)}
        />
      ) : (
        <Button title={t('campus.join')} icon={UserPlus} variant="secondary" size="sm" loading={busy} onPress={join} />
      )}
    </Card>
  );
}

/** Entry point on Home and in Groups for students of a launch campus (or going there). */
export function CampusCard() {
  const { profile } = useSession();
  const { data: launched } = useQuery(listLaunchCampuses, []);
  const campusId = campusFor(profile, launched ?? []);
  const { data: plans } = useQuery(() => (campusId ? listPlans(campusId) : Promise.resolve([] as Plan[])), [campusId]);
  const university = getUniversity(campusId);
  if (!campusId || !university) return null;

  const live = upcomingPlans(plans ?? []).length;
  const body = live > 0 ? t('campus.teaserPlans', { n: live }) : t('campus.teaserNoPlans');
  const title = t('campus.teaserTitle', { university: university.name });

  return (
    <Card
      onPress={() => router.push({ pathname: '/campus/[id]', params: { id: campusId } })}
      accessibilityLabel={`${title}. ${body}`}
      style={styles.teaser}>
      <IconTile icon={PartyPopper} colors={gradients.primary} size={44} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="callout" color="textSecondary">
          {body}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

/** For students outside the launch campuses: where UNIverse started, and an invitation to bring it to theirs. */
export function LaunchInviteCard() {
  const { profile } = useSession();
  const { data: launched } = useQuery(listLaunchCampuses, []);
  const first = getUniversity(launched?.[0]);
  if (!launched || !first || campusFor(profile, launched)) return null;

  const invite = () => {
    Share.share({ message: t('campus.inviteShare') }).catch(() => undefined);
  };

  return (
    <Card style={styles.invite}>
      <Text variant="bodyStrong">{t('campus.launchTitle', { university: first.name })}</Text>
      <Text variant="callout" color="textSecondary">
        {t('campus.launchBody')}
      </Text>
      <Button title={t('campus.invite')} icon={Share2} variant="secondary" size="sm" onPress={invite} style={styles.inviteButton} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  plan: {
    gap: spacing.sm,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  invite: {
    gap: spacing.sm,
  },
  inviteButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
});
