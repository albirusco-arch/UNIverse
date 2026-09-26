import { router } from 'expo-router';
import { ArrowRight, Bookmark, Compass, Search, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand';
import { GradientText } from '@/components/gradient-text';
import { PostCard } from '@/components/post-card';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChipScroller,
  DemoBadge,
  IconTile,
  Input,
  Screen,
  SectionHeader,
  Text,
} from '@/components/ui';
import { getUniversity, listPosts } from '@/data/api';
import type { Region } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, radius, spacing, type } from '@/theme/tokens';

const REGIONS: (Region | 'all')[] = ['all', 'europe', 'uk', 'north_america', 'asia', 'oceania'];

const quickAccess: {
  icon: LucideIcon;
  label: () => string;
  colors: readonly [string, string];
  href: '/match' | '/explore' | '/community' | '/profile';
}[] = [
  { icon: Sparkles, label: () => t('home.quickMatch'), colors: gradients.violet, href: '/match' },
  { icon: Compass, label: () => t('home.quickDestinations'), colors: gradients.teal, href: '/explore' },
  { icon: Users, label: () => t('home.quickCommunity'), colors: gradients.indigo, href: '/community' },
  { icon: Bookmark, label: () => t('home.quickSaved'), colors: gradients.purple, href: '/profile' },
];

function ExchangeCard() {
  const { profile } = useSession();
  const destination = getUniversity(profile.destinationId);

  if (!destination) {
    return (
      <Card tone="violet" style={styles.planCard}>
        <Text variant="title3">{t('home.noPlanTitle')}</Text>
        <Text variant="callout" color="textSecondary">
          {t('home.noPlanBody')}
        </Text>
        <Button title={t('home.setUp')} iconRight={ArrowRight} onPress={() => router.push('/onboarding?edit=1')} />
      </Card>
    );
  }

  const details = [
    profile.field ? t(`fields.${profile.field}`) : null,
    profile.level ? t(`levels.${profile.level}`) : null,
    profile.term,
  ].filter(Boolean);

  return (
    <Card tone="violet" style={styles.planCard}>
      <Text variant="overline" color="violetPale">
        {t('home.yourExchange')}
      </Text>
      <View style={styles.route}>
        <Text variant="bodyStrong" color="textSecondary" numberOfLines={1} style={styles.routeFrom}>
          {profile.homeUniversity || '—'}
        </Text>
        <ArrowRight size={16} color={colors.violetLight} />
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/university/[id]', params: { id: destination.id } })}
        accessibilityRole="button">
        <Text variant="title2">
          {flagEmoji(destination.countryCode)} {destination.name}
        </Text>
      </Pressable>
      {details.length > 0 && (
        <Text variant="callout" color="textMuted">
          {details.join(' · ')}
        </Text>
      )}
      <View style={styles.planActions}>
        <Button
          title={t('home.matchCourses')}
          icon={Sparkles}
          onPress={() => router.navigate({ pathname: '/match', params: { destinationId: destination.id } })}
        />
        <Button
          title={t('home.pathStudents')}
          variant="secondary"
          icon={Users}
          onPress={() => router.navigate({ pathname: '/community', params: { filter: 'path' } })}
        />
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const { profile } = useSession();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<Region | 'all'>('all');

  const { data: pathPosts } = useQuery(
    () => listPosts({ universityId: profile.destinationId ?? undefined, limit: 2 }),
    [profile.destinationId],
  );
  const { data: latestPosts } = useQuery(() => listPosts({ limit: 2 }), []);
  const showPath = Boolean(profile.destinationId && pathPosts?.length);
  const posts = showPath ? pathPosts : latestPosts;

  const findDestinations = () =>
    router.navigate({ pathname: '/explore', params: { q: query.trim(), region } });

  return (
    <Screen tab>
      <View style={styles.topBar}>
        <Wordmark />
        <View style={styles.topRight}>
          <DemoBadge />
          <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel={t('tabs.profile')}>
            <Avatar name={profile.displayName || '?'} size={40} />
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <Text variant="display">{t('onboarding.welcomeTitle')}</Text>
        <GradientText text={t('onboarding.welcomeAccent')} style={type.display} />
      </View>

      <ExchangeCard />

      <Card style={styles.searchCard}>
        <Input
          icon={Search}
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.searchPlaceholder')}
          returnKeyType="search"
          onSubmitEditing={findDestinations}
        />
        <View>
          <Text variant="overline" color="textMuted" style={styles.chipLabel}>
            {t('home.region')}
          </Text>
          <ChipScroller>
            {REGIONS.map((r) => (
              <Chip key={r} label={t(`regions.${r}`)} selected={region === r} onPress={() => setRegion(r)} />
            ))}
          </ChipScroller>
        </View>
        <Button title={t('home.findDestinations')} icon={Search} iconRight={ArrowRight} onPress={findDestinations} />
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t('home.quickAccess')} />
        <View style={styles.quickGrid}>
          {quickAccess.map((item) => (
            <Pressable
              key={item.href}
              onPress={() => router.navigate(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.label()}
              style={({ pressed }) => [styles.quickItem, pressed && { transform: [{ scale: 0.96 }] }]}>
              <IconTile icon={item.icon} colors={item.colors} />
              <Text variant="caption" color="textSecondary" align="center" numberOfLines={1}>
                {item.label()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {posts && posts.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title={showPath ? t('home.fromYourPath') : t('home.fromCommunity')}
            action={t('common.seeAll')}
            onAction={() => router.navigate('/community')}
          />
          <View style={styles.list}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
        </View>
      )}

      <Card tone="teal" style={[styles.section, styles.trust]}>
        <View style={styles.trustIcon}>
          <ShieldCheck size={20} color={colors.tealLight} />
        </View>
        <View style={styles.trustText}>
          <Text variant="bodyStrong">{t('home.trustTitle')}</Text>
          <Text variant="callout" color="textSecondary">
            {t('home.trustBody')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hero: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  planCard: {
    gap: spacing.sm,
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  routeFrom: {
    flexShrink: 1,
  },
  planActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  searchCard: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  chipLabel: {
    marginBottom: 8,
  },
  section: {
    marginTop: spacing.xxl,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    gap: 8,
  },
  list: {
    gap: spacing.md,
  },
  trust: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.xl,
  },
  trustIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    flex: 1,
    gap: 4,
  },
});
