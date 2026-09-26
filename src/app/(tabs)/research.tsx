import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeftRight,
  ChevronRight,
  Clock,
  GraduationCap,
  Plane,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { SignInCard } from '@/components/account-gate';
import { CountryPicker } from '@/components/country-picker';
import { CvAnalysisCard } from '@/components/premium-card';
import { UniversityNameInput, UniversityPicker } from '@/components/university-picker';
import { Badge, Button, Card, Chip, ChipRow, DemoBadge, EmptyState, IconTile, Input, Screen, SectionHeader, Text } from '@/components/ui';
import { countryName, getUniversity, listMyResearch, RateLimitError, requestResearch, trackSignal } from '@/data/api';
import {
  LEVELS,
  RESEARCH_KINDS,
  type Level,
  type Research,
  type ResearchKind,
  type ResearchRequest,
  type StudyType,
} from '@/data/types';
import { getLanguage, t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, gradients, radius, spacing } from '@/theme/tokens';

type CourseDraft = { key: number; name: string; ects: string };

let nextKey = 1;
const blankCourse = (): CourseDraft => ({ key: nextKey++, name: '', ects: '' });

const kindIcons: Record<ResearchKind, { icon: LucideIcon; colors: typeof gradients.primary }> = {
  exchange: { icon: ArrowLeftRight, colors: gradients.primary },
  admission: { icon: GraduationCap, colors: gradients.accent },
  scholarships: { icon: Wallet, colors: gradients.success },
  visa: { icon: Plane, colors: gradients.sky },
};

function isKind(value: string | undefined): value is ResearchKind {
  return (RESEARCH_KINDS as readonly string[]).includes(value ?? '');
}

function HistoryItem({ research }: { research: Research }) {
  const destination = getUniversity(research.request.destinationId);
  const status =
    research.status === 'done'
      ? { label: t('research.statusDone'), tone: 'success' as const }
      : research.status === 'error'
        ? { label: t('research.statusError'), tone: 'red' as const }
        : { label: t('research.statusPending'), tone: 'amber' as const };
  const kind = kindIcons[research.kind];
  const where =
    destination?.name ?? (research.request.destinationName || countryName(research.request.destinationCountry));
  return (
    <Card
      onPress={() => router.push({ pathname: '/research/[id]', params: { id: research.id } })}
      accessibilityLabel={`${t(`research.kinds.${research.kind}`)}: ${where}`}
      style={styles.historyItem}>
      <IconTile icon={kind.icon} colors={kind.colors} size={40} />
      <View style={styles.historyText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {where}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {t(`research.kinds.${research.kind}`)} · {formatDate(research.createdAt)}
        </Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="overline" color="textMuted" style={styles.groupLabel}>
      {children}
    </Text>
  );
}

function ResearchForm() {
  const params = useLocalSearchParams<{ kind?: string; destinationId?: string }>();
  const { profile } = useSession();
  const home = getUniversity(profile.homeUniversityId);

  const [kind, setKind] = useState<ResearchKind>(isKind(params.kind) ? params.kind : 'exchange');
  const [homeUniversity, setHomeUniversity] = useState(profile.homeUniversity);
  const [program, setProgram] = useState('');
  const [level, setLevel] = useState<Level>(profile.level ?? 'bachelor');
  const [destinationId, setDestinationId] = useState<string | null>(params.destinationId ?? profile.destinationId);
  const [destinationCountry, setDestinationCountry] = useState('');
  const [citizenship, setCitizenship] = useState(home?.countryCode ?? '');
  const [qualification, setQualification] = useState('');
  const [studyType, setStudyType] = useState<StudyType>('exchange');
  const [term, setTerm] = useState(profile.term ?? '');
  const [duration, setDuration] = useState('');
  const [courses, setCourses] = useState<CourseDraft[]>([blankCourse()]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Other screens open this tab with a kind or destination pre-selected.
  const [seenParams, setSeenParams] = useState(params);
  if (params.kind !== seenParams.kind || params.destinationId !== seenParams.destinationId) {
    setSeenParams(params);
    if (isKind(params.kind)) setKind(params.kind);
    if (params.destinationId) setDestinationId(params.destinationId);
  }

  const { data: history } = useQuery(listMyResearch, []);

  const destination = getUniversity(destinationId);
  const country = destination?.countryCode ?? destinationCountry;

  const updateCourse = (key: number, changes: Partial<CourseDraft>) =>
    setCourses((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));

  const filledCourses = courses
    .filter((c) => c.name.trim())
    .map((c) => {
      const ects = Number.parseFloat(c.ects.replace(',', '.'));
      return { name: c.name.trim(), ects: Number.isFinite(ects) ? ects : null };
    });

  const valid = (() => {
    switch (kind) {
      case 'exchange':
        return homeUniversity.trim().length >= 2 && destination !== undefined && filledCourses.length > 0;
      case 'admission':
        return destination !== undefined && program.trim().length >= 2;
      case 'scholarships':
        return country !== '';
      case 'visa':
        return citizenship !== '' && country !== '';
    }
  })();

  const submit = async () => {
    if (!valid) return setError(t('research.required'));
    const months = Number.parseInt(duration, 10);
    const request: ResearchRequest = {
      kind,
      homeUniversity: homeUniversity.trim(),
      program: program.trim(),
      level,
      field: profile.field,
      destinationId: destination?.id ?? null,
      destinationName: destination?.name ?? '',
      destinationCountry: country,
      citizenship,
      qualification: qualification.trim(),
      studyType: kind === 'exchange' ? 'exchange' : kind === 'admission' ? 'degree' : studyType,
      term: term.trim(),
      durationMonths: Number.isFinite(months) && months > 0 ? Math.min(months, 72) : null,
      courses: kind === 'exchange' ? filledCourses : [],
      notes: notes.trim(),
      language: getLanguage(),
    };

    setError(null);
    setSubmitting(true);
    try {
      const id = await requestResearch(request);
      if (destination) trackSignal('research', destination.id);
      for (const course of request.courses) trackSignal('course', course.name);
      if (request.program) trackSignal('course', request.program);
      router.push({ pathname: '/research/[id]', params: { id } });
    } catch (err) {
      setError(err instanceof RateLimitError ? t('common.limit') : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const destinationPicker = (
    <UniversityPicker
      label={kind === 'exchange' || kind === 'admission' ? t('research.destination') : t('research.destinationOptional')}
      value={destinationId}
      onChange={setDestinationId}
      placeholder={t('onboarding.destinationPlaceholder')}
      excludeId={kind === 'exchange' ? profile.homeUniversityId : null}
    />
  );

  const countryPicker = !destination && (
    <CountryPicker
      label={t('research.destinationCountry')}
      value={destinationCountry}
      onChange={setDestinationCountry}
      placeholder={t('research.countryPlaceholder')}
    />
  );

  const citizenshipPicker = (
    <CountryPicker
      label={t('research.citizenship')}
      value={citizenship}
      onChange={setCitizenship}
      placeholder={t('research.countryPlaceholder')}
    />
  );

  const levelChips = (
    <View>
      <Label>{t('research.level')}</Label>
      <ChipRow>
        {LEVELS.map((l) => (
          <Chip key={l} tone="accent" label={t(`levels.${l}`)} selected={level === l} onPress={() => setLevel(l)} />
        ))}
      </ChipRow>
    </View>
  );

  const studyTypeChips = (
    <View>
      <Label>{t('research.studyType')}</Label>
      <ChipRow>
        {(['exchange', 'degree'] as const).map((type) => (
          <Chip
            key={type}
            label={t(`research.studyTypes.${type}`)}
            selected={studyType === type}
            onPress={() => setStudyType(type)}
          />
        ))}
      </ChipRow>
    </View>
  );

  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <Text variant="title1" accessibilityRole="header">
          {t('research.title')}
        </Text>
        <DemoBadge />
      </View>
      <Text variant="callout" color="textSecondary" style={styles.subtitle}>
        {t('research.subtitle')}
      </Text>

      <View style={styles.kinds} accessibilityRole="radiogroup">
        {RESEARCH_KINDS.map((k) => {
          const selected = kind === k;
          return (
            <Pressable
              key={k}
              onPress={() => {
                setKind(k);
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`research.kinds.${k}`)}
              style={({ pressed }) => [styles.kind, selected && styles.kindSelected, pressed && { opacity: 0.85 }]}>
              <IconTile icon={kindIcons[k].icon} colors={kindIcons[k].colors} size={36} />
              <Text variant="bodyStrong" numberOfLines={1}>
                {t(`research.kinds.${k}`)}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {t(`research.kindBodies.${k}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.form}>
        {kind === 'exchange' && (
          <>
            <UniversityNameInput
              label={t('research.homeUniversity')}
              value={homeUniversity}
              onChangeText={setHomeUniversity}
              placeholder={t('onboarding.homeUniversityPlaceholder')}
            />
            <Input
              label={t('research.program')}
              value={program}
              onChangeText={setProgram}
              placeholder={t('research.programPlaceholder')}
            />
            {levelChips}
            {destinationPicker}
            <Input label={t('research.term')} value={term} onChangeText={setTerm} placeholder={t('research.termPlaceholder')} />
            <View>
              <Label>{t('research.courses')}</Label>
              <Text variant="caption" color="textMuted" style={styles.hint}>
                {t('research.coursesHint')}
              </Text>
              <View style={styles.courses}>
                {courses.map((course, index) => (
                  <View key={course.key} style={styles.courseRow}>
                    <TextInput
                      value={course.name}
                      onChangeText={(name) => updateCourse(course.key, { name })}
                      placeholder={`${t('research.courseName')} ${index + 1}`}
                      placeholderTextColor={colors.textMuted}
                      accessibilityLabel={`${t('research.courseName')} ${index + 1}`}
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
                  title={t('research.addCourse')}
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onPress={() => setCourses((list) => [...list, blankCourse()])}
                  style={styles.addCourse}
                />
              )}
            </View>
          </>
        )}

        {kind === 'admission' && (
          <>
            {destinationPicker}
            <Input
              label={t('research.targetProgram')}
              value={program}
              onChangeText={setProgram}
              placeholder={t('research.targetProgramPlaceholder')}
            />
            {levelChips}
            <Input
              label={t('research.qualification')}
              value={qualification}
              onChangeText={setQualification}
              placeholder={t('research.qualificationPlaceholder')}
            />
            {citizenshipPicker}
          </>
        )}

        {kind === 'scholarships' && (
          <>
            {destinationPicker}
            {countryPicker}
            {studyTypeChips}
            {levelChips}
            <Input
              label={t('research.program')}
              value={program}
              onChangeText={setProgram}
              placeholder={t('research.programPlaceholder')}
            />
            {citizenshipPicker}
            <Input label={t('research.term')} value={term} onChangeText={setTerm} placeholder={t('research.termPlaceholder')} />
          </>
        )}

        {kind === 'visa' && (
          <>
            {citizenshipPicker}
            {destinationPicker}
            {countryPicker}
            {studyTypeChips}
            <Input
              label={t('research.duration')}
              value={duration}
              onChangeText={(value) => setDuration(value.replace(/\D/g, '').slice(0, 2))}
              placeholder="6"
              keyboardType="number-pad"
            />
          </>
        )}

        <Input
          label={`${t('research.notes')} (${t('common.optional').toLowerCase()})`}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('research.notesPlaceholder')}
          multiline
          maxLength={500}
        />

        {error && (
          <Text variant="callout" color="red" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <Button
          title={submitting ? t('research.submitting') : t('research.submit')}
          icon={Sparkles}
          onPress={submit}
          loading={submitting}
          disabled={!valid}
        />
        <View style={styles.duration}>
          <Clock size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted" style={styles.durationText}>
            {t('research.duration1to3')}
          </Text>
        </View>
      </Card>

      <View style={styles.premium}>
        <CvAnalysisCard />
      </View>

      <View style={styles.history}>
        <SectionHeader title={t('research.history')} />
        {history && history.length > 0 ? (
          <View style={styles.historyList}>
            {history.map((research) => (
              <HistoryItem key={research.id} research={research} />
            ))}
          </View>
        ) : (
          <EmptyState icon={Sparkles} text={t('research.noHistory')} />
        )}
      </View>
    </Screen>
  );
}

/** Guests see what the AI does and are invited to sign up; the Premium card stays visible. */
function GuestResearch() {
  return (
    <Screen tab>
      <View style={styles.titleRow}>
        <Text variant="title1" accessibilityRole="header">
          {t('research.title')}
        </Text>
        <DemoBadge />
      </View>
      <Text variant="callout" color="textSecondary" style={styles.subtitle}>
        {t('research.subtitle')}
      </Text>
      <SignInCard feature="research" />
      <View style={styles.premium}>
        <CvAnalysisCard />
      </View>
    </Screen>
  );
}

export default function ResearchTab() {
  const { signedIn } = useSession();
  return signedIn ? <ResearchForm /> : <GuestResearch />;
}

const styles = StyleSheet.create({
  premium: {
    marginTop: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  kind: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kindSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
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
