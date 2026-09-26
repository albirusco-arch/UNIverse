import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeftRight, Bookmark, ExternalLink, Globe, MapPin, MessageCirclePlus, Sparkles, Users } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EquivalenceCard } from '@/components/equivalence-card';
import { PostCard } from '@/components/post-card';
import { Segmented } from '@/components/segmented';
import { regionGradients } from '@/components/university-card';
import { Button, Card, EmptyState, Header, IconButton, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import {
  getUniversity,
  listEquivalences,
  listPosts,
  listSavedUniversityIds,
  setUniversitySaved,
} from '@/data/api';
import type { Post, Topic } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji, hostname } from '@/lib/format';
import { useModeration } from '@/lib/use-moderation';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

type Tab = 'overview' | 'courses' | 'community' | 'life';
const LIFE_TOPICS: Topic[] = ['housing', 'tip'];

function PostList({ posts, empty, action }: { posts: Post[] | undefined; empty: string; action: ReactNode }) {
  if (!posts) return null;
  if (posts.length === 0) return <EmptyState icon={Users} text={empty} action={action} />;
  return (
    <View style={styles.list}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {action}
    </View>
  );
}

export default function UniversityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const university = getUniversity(id);
  const [tab, setTab] = useState<Tab>('overview');
  const { ensureSignedIn } = useModeration();

  const { data: posts } = useQuery(() => listPosts({ universityId: id }), [id]);
  const { data: equivalences } = useQuery(() => listEquivalences({ destinationId: id }), [id]);
  const { data: savedIds } = useQuery(listSavedUniversityIds, []);

  if (!university) {
    return (
      <Screen header={<Header />}>
        <EmptyState icon={Globe} text={t('common.error')} />
      </Screen>
    );
  }

  const saved = savedIds?.includes(university.id) ?? false;
  const lifePosts = posts?.filter((p) => LIFE_TOPICS.includes(p.topic));
  const communityPosts = posts?.filter((p) => !LIFE_TOPICS.includes(p.topic));

  const startMatch = () => router.navigate({ pathname: '/match', params: { destinationId: university.id } });
  const compose = (topic: Topic) => {
    if (!ensureSignedIn()) return;
    router.push({ pathname: '/post/new', params: { universityId: university.id, topic } });
  };
  const addEquivalence = () => {
    if (!ensureSignedIn()) return;
    router.push({ pathname: '/equivalence/new', params: { destinationId: university.id } });
  };
  const toggleSaved = () => {
    if (!ensureSignedIn()) return;
    setUniversitySaved(university.id, !saved).catch(() => undefined);
  };

  const header = (
    <Header
      right={
        <IconButton
          label={t('university.saveUniversity')}
          active={saved}
          onPress={toggleSaved}
          icon={<Bookmark size={20} color={saved ? colors.violetLight : colors.text} fill={saved ? colors.violetLight : 'transparent'} />}
        />
      }
    />
  );

  return (
    <Screen header={header}>
      <LinearGradient colors={regionGradients[university.region]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.flag}>{flagEmoji(university.countryCode)}</Text>
        <Text variant="title1">{university.name}</Text>
        <View style={styles.location}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text variant="callout" color="textSecondary">
            {university.city}, {university.country}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: t('university.overview') },
            { value: 'courses', label: t('university.courses') },
            { value: 'community', label: t('university.community') },
            { value: 'life', label: t('university.life') },
          ]}
        />
      </View>

      {tab === 'overview' && (
        <View style={styles.stack}>
          <Card tone="violet" style={styles.planCard}>
            <View style={styles.planTitle}>
              <Sparkles size={18} color={colors.violetLight} />
              <Text variant="title3">{t('university.planHere')}</Text>
            </View>
            <Text variant="callout" color="textSecondary">
              {t('university.planHereBody')}
            </Text>
            <Button title={t('university.startMatch')} icon={Sparkles} onPress={startMatch} />
          </Card>

          <View>
            <SectionHeader title={t('university.officialLinks')} />
            <Card style={styles.linksCard}>
              <ListRow
                icon={ExternalLink}
                label={t('university.website')}
                value={hostname(university.website)}
                onPress={() => WebBrowser.openBrowserAsync(university.website)}
              />
            </Card>
          </View>

          <View>
            <SectionHeader
              title={t('university.equivalencesTitle')}
              action={equivalences?.length ? t('common.seeAll') : undefined}
              onAction={() => setTab('courses')}
            />
            {equivalences && equivalences.length > 0 ? (
              <EquivalenceCard equivalence={equivalences[0]} destinationName={university.name} />
            ) : (
              <Text variant="callout" color="textMuted">
                {t('university.noEquivalences')}
              </Text>
            )}
          </View>

          <View>
            <SectionHeader
              title={t('university.studentsSay')}
              action={communityPosts?.length ? t('common.seeAll') : undefined}
              onAction={() => setTab('community')}
            />
            {communityPosts && communityPosts.length > 0 ? (
              <PostCard post={communityPosts[0]} />
            ) : (
              <Text variant="callout" color="textMuted">
                {t('university.noPosts')}
              </Text>
            )}
          </View>
        </View>
      )}

      {tab === 'courses' && (
        <View style={styles.stack}>
          <Text variant="callout" color="textSecondary">
            {t('university.equivalencesBody')}
          </Text>
          {equivalences && equivalences.length > 0 ? (
            <View style={styles.list}>
              {equivalences.map((e) => (
                <EquivalenceCard key={e.id} equivalence={e} destinationName={university.name} />
              ))}
            </View>
          ) : (
            <EmptyState icon={ArrowLeftRight} text={t('university.noEquivalences')} />
          )}
          <Button title={t('university.addEquivalence')} variant="secondary" icon={ArrowLeftRight} onPress={addEquivalence} />
          <Button title={t('university.startMatch')} icon={Sparkles} onPress={startMatch} />
        </View>
      )}

      {tab === 'community' && (
        <PostList
          posts={communityPosts}
          empty={t('university.noPosts')}
          action={
            <Button title={t('university.askQuestion')} variant="secondary" icon={MessageCirclePlus} onPress={() => compose('question')} />
          }
        />
      )}

      {tab === 'life' && (
        <View style={styles.stack}>
          <Text variant="callout" color="textSecondary">
            {t('university.lifeBody')}
          </Text>
          <PostList
            posts={lifePosts}
            empty={t('university.noLife')}
            action={<Button title={t('university.shareTip')} variant="secondary" icon={MessageCirclePlus} onPress={() => compose('housing')} />}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  flag: {
    fontSize: 44,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabs: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  stack: {
    gap: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  planCard: {
    gap: spacing.md,
  },
  planTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linksCard: {
    padding: 0,
    overflow: 'hidden',
  },
});
