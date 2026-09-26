import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, Clock, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { UniversityNameInput, UniversityPicker } from '@/components/university-picker';
import { Badge, Button, Card, Chip, ChipRow, DemoBadge, EmptyState, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { getUniversity, listMyMatches, RateLimitError, requestCourseMatch } from '@/data/api';
import { LEVELS, type CourseMatch, type Level } from '@/data/types';
import { locale, t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

type CourseDraft = { key: number; name: string; ects: string };

let nextKey = 1;
const blankCourse = (): CourseDraft => ({ key: nextKey++, name: '', ects: '' });

function MatchHistoryItem({ match }: { match: CourseMatch }) {
  const destination = getUniversity(match.request.destinationId);
  const status =
    match.status === 'done'
      ? { label: t('match.statusDone'), tone: 'teal' as const }
      : match.status === 'error'
        ? { label: t('match.statusError'), tone: 'red' as const }
        : { label: t('match.statusPending'), tone: 'amber' as const };
  return (
    <Card
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
      accessibilityLabel={match.request.destinationName}
      style={styles.historyItem}>
      <View style={styles.historyText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {destination?.name ?? match.request.destinationName}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {match.request.courses.map((c) => c.name).join(', ')}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatDate(match.createdAt)}
        </Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

export default function MatchScreen() {
  const params = useLocalSearchParams<{ destinationId?: string }>();
  const { profile, signedIn } = useSession();

  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [program, setProgram] = useState(profile.field ? t(`fields.${profile.field}`) : '');
  const [level, setLevel] = useState<Level>(profile.level ?? 'bachelor');
  const [destinationId, setDestinationId] = useState<string | null>(params.destinationId ?? profile.destinationId);
  const [term, setTerm] = useState(profile.term ?? '');
  const [courses, setCourses] = useState<CourseDraft[]>([blankCourse()]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Other screens open this tab with a destination pre-selected.
  const [seenDestination, setSeenDestination] = useState(params.destinationId);
  if (params.destinationId !== seenDestination) {
    setSeenDestination(params.destinationId);
    if (params.destinationId) setDestinationId(params.destinationId);
  }

  const { data: history } = useQuery(listMyMatches, [signedIn]);

  const updateCourse = (key: number, changes: Partial<CourseDraft>) =>
    setCourses((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));

  const submit = async () => {
    const filled = courses.filter((c) => c.name.trim());
    const destination = getUniversity(destinationId);
    if (!homeUniversity.trim()) return setError(t('match.validationHome'));
    if (!destination) return setError(t('match.validationDestination'));
    if (filled.length === 0) return setError(t('match.validationCourses'));
    if (!signedIn) return router.push('/auth');

    setError(null);
    setSubmitting(true);
    try {
      const id = await requestCourseMatch({
        homeUniversity: homeUniversity.trim(),
        program: program.trim(),
        level,
        destinationId: destination.id,
        destinationName: destination.name,
        term: term.trim(),
        courses: filled.map((c) => {
          const ects = Number.parseFloat(c.ects.replace(',', '.'));
          return { name: c.name.trim(), ects: Number.isFinite(ects) ? ects : null };
        }),
        notes: notes.trim(),
        locale,
      });
      router.push({ pathname: '/match/[id]', params: { id } });
    } catch (err) {
      setError(err instanceof RateLimitError ? t('match.limit') : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <Text variant="title1" accessibilityRole="header">
          {t('match.title')}
        </Text>
        <DemoBadge />
      </View>
      <Text variant="callout" color="textSecondary" style={styles.subtitle}>
        {t('match.subtitle')}
      </Text>

      <Card style={styles.form}>
        <UniversityNameInput
          label={t('match.homeUniversity')}
          value={homeUniversity}
          onChangeText={setHomeUniversity}
          placeholder={t('onboarding.homeUniversityPlaceholder')}
        />
        <Input label={t('match.program')} value={program} onChangeText={setProgram} placeholder={t('match.programPlaceholder')} />
        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('match.level')}
          </Text>
          <ChipRow>
            {LEVELS.map((l) => (
              <Chip key={l} tone="teal" label={t(`levels.${l}`)} selected={level === l} onPress={() => setLevel(l)} />
            ))}
          </ChipRow>
        </View>
        <UniversityPicker
          label={t('match.destination')}
          value={destinationId}
          onChange={setDestinationId}
          placeholder={t('onboarding.destinationPlaceholder')}
        />
        <Input label={t('match.term')} value={term} onChangeText={setTerm} placeholder={t('match.termPlaceholder')} />

        <View>
          <Text variant="overline" color="textMuted" style={styles.groupLabel}>
            {t('match.courses')}
          </Text>
          <Text variant="caption" color="textMuted" style={styles.hint}>
            {t('match.coursesHint')}
          </Text>
          <View style={styles.courses}>
            {courses.map((course, index) => (
              <View key={course.key} style={styles.courseRow}>
                <TextInput
                  value={course.name}
                  onChangeText={(name) => updateCourse(course.key, { name })}
                  placeholder={`${t('match.courseName')} ${index + 1}`}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={`${t('match.courseName')} ${index + 1}`}
                  style={[styles.courseInput, styles.courseName]}
                />
                <TextInput
                  value={course.ects}
                  onChangeText={(ects) => updateCourse(course.key, { ects })}
                  placeholder="ECTS"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`ECTS ${index + 1}`}
                  style={[styles.courseInput, styles.courseEcts]}
                />
                {courses.length > 1 && (
                  <Pressable
                    onPress={() => setCourses((list) => list.filter((c) => c.key !== course.key))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('common.delete')} ${index + 1}`}>
                    <Trash2 size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {courses.length < 12 && (
            <Button
              title={t('match.addCourse')}
              variant="ghost"
              size="sm"
              icon={Plus}
              onPress={() => setCourses((list) => [...list, blankCourse()])}
              style={styles.addCourse}
            />
          )}
        </View>

        <Input
          label={`${t('match.notes')} (${t('common.optional').toLowerCase()})`}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('match.notesPlaceholder')}
          multiline
          maxLength={500}
        />

        {error && (
          <Text variant="callout" color="red" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <Button
          title={submitting ? t('match.submitting') : t('match.submit')}
          icon={Sparkles}
          onPress={submit}
          loading={submitting}
        />
        <View style={styles.duration}>
          <Clock size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted" style={styles.durationText}>
            {t('match.duration')}
          </Text>
        </View>
      </Card>

      <View style={styles.history}>
        <SectionHeader title={t('match.history')} />
        {history && history.length > 0 ? (
          <View style={styles.historyList}>
            {history.map((match) => (
              <MatchHistoryItem key={match.id} match={match} />
            ))}
          </View>
        ) : (
          <EmptyState icon={Sparkles} text={t('match.noHistory')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.xl,
  },
  groupLabel: {
    marginBottom: 6,
  },
  hint: {
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  courses: {
    gap: spacing.sm,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  courseInput: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  courseName: {
    flex: 1,
  },
  courseEcts: {
    width: 72,
    textAlign: 'center',
  },
  addCourse: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  duration: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  durationText: {
    flex: 1,
    fontWeight: '500',
  },
  history: {
    marginTop: spacing.xxl,
  },
  historyList: {
    gap: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  historyText: {
    flex: 1,
    gap: 2,
  },
});
