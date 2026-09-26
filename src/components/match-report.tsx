import * as WebBrowser from 'expo-web-browser';
import {
  ArrowDown,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
  Info,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Card, SectionHeader, Text, type BadgeTone } from '@/components/ui';
import type {
  CourseFit,
  CoursePairing,
  Equivalence,
  MatchReport,
  MatchSource,
  RequirementCategory,
  Verifiable,
} from '@/data/types';
import { t } from '@/i18n';
import { formatDate, hostname } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

const fitTones: Record<CourseFit, BadgeTone> = {
  strong: 'teal',
  partial: 'violet',
  weak: 'amber',
  none: 'red',
};

const CATEGORY_ORDER: RequirementCategory[] = [
  'language',
  'academic',
  'credits',
  'application',
  'documents',
  'financial',
  'deadline',
  'other',
];

function openSource(url: string) {
  if (url) WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

function SourceChips({ ids, sources }: { ids: number[]; sources: MatchSource[] }) {
  const cited = ids.map((id) => sources.find((s) => s.id === id)).filter((s): s is MatchSource => Boolean(s));
  if (cited.length === 0) return null;
  return (
    <View style={styles.sourceChips}>
      {cited.map((source) => (
        <Pressable
          key={source.id}
          onPress={() => openSource(source.url)}
          accessibilityRole="link"
          accessibilityLabel={`${t('report.sources')} ${source.id}: ${source.title}`}
          hitSlop={6}
          style={styles.sourceChip}>
          <Text variant="caption" color="violetPale">
            [{source.id}] {hostname(source.url)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function VerificationBadge({ item }: { item: Verifiable }) {
  return item.verified ? (
    <Badge icon={CircleCheck} tone="teal" label={t('report.verified')} />
  ) : (
    <Badge icon={TriangleAlert} tone="amber" label={t('report.needsCheck')} />
  );
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function approvedCount(pairing: CoursePairing, equivalences: Equivalence[]) {
  const target = normalize(pairing.destinationCourse);
  if (!target) return 0;
  return equivalences.filter((e) => e.approved && normalize(e.destinationCourse) === target).length;
}

function CourseMatchCard({
  pairing,
  sources,
  equivalences,
}: {
  pairing: CoursePairing;
  sources: MatchSource[];
  equivalences: Equivalence[];
}) {
  const approvals = approvedCount(pairing, equivalences);
  const meta = [
    pairing.destinationCode,
    pairing.destinationEcts !== null ? t('common.ects', { n: pairing.destinationEcts }) : '',
    pairing.semester,
    pairing.language,
  ].filter(Boolean);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowBetween}>
        <Badge tone={fitTones[pairing.fit]} label={t(`report.fit.${pairing.fit}`)} />
        <VerificationBadge item={pairing} />
      </View>
      <View>
        <Text variant="bodyStrong">{pairing.homeCourse}</Text>
        {pairing.homeEcts !== null && (
          <Text variant="caption" color="textMuted">
            {t('common.ects', { n: pairing.homeEcts })}
          </Text>
        )}
      </View>
      {pairing.fit !== 'none' && pairing.destinationCourse ? (
        <>
          <ArrowDown size={16} color={colors.textMuted} />
          <Pressable onPress={() => openSource(pairing.url)} disabled={!pairing.url} accessibilityRole={pairing.url ? 'link' : undefined}>
            <View style={styles.inline}>
              <Text variant="bodyStrong" color="violetPale" style={styles.flexShrink}>
                {pairing.destinationCourse}
              </Text>
              {pairing.url ? <ExternalLink size={14} color={colors.violetPale} /> : null}
            </View>
            {meta.length > 0 && (
              <Text variant="caption" color="textMuted">
                {meta.join(' · ')}
              </Text>
            )}
          </Pressable>
        </>
      ) : null}
      <Text variant="callout" color="textSecondary">
        {pairing.rationale}
      </Text>
      {approvals > 0 && (
        <Badge icon={Users} tone="teal" label={t('report.communityApproved', { n: approvals })} />
      )}
      <SourceChips ids={pairing.sourceIds} sources={sources} />
    </Card>
  );
}

export function MatchReportView({
  report,
  equivalences,
  isDemo = false,
}: {
  report: MatchReport;
  equivalences: Equivalence[];
  isDemo?: boolean;
}) {
  const items: Verifiable[] = [...report.requirements, ...report.deadlines, ...report.courseMatches];
  const verified = items.filter((item) => item.verified).length;
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: report.requirements.filter((r) => r.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <View style={styles.container}>
      {isDemo && (
        <Card tone="amber" style={styles.inline}>
          <Info size={18} color={colors.amber} />
          <Text variant="callout" style={styles.flexShrink}>
            {t('report.demoBanner')}
          </Text>
        </Card>
      )}

      <Card tone="teal" style={styles.verifyCard}>
        <ShieldCheck size={22} color={colors.tealLight} />
        <View style={styles.flexShrink}>
          <Text variant="bodyStrong">{t('report.verifiedCount', { verified, total: items.length })}</Text>
          <Text variant="caption" color="textSecondary">
            {t('report.checkedOn', { date: formatDate(report.checkedAt) })}
            {report.academicYear ? ` · ${t('report.academicYear', { year: report.academicYear })}` : ''}
          </Text>
        </View>
      </Card>

      <View>
        <SectionHeader title={t('report.summary')} />
        <Text variant="body" color="textSecondary">
          {report.summary}
        </Text>
      </View>

      {report.courseMatches.length > 0 && (
        <View>
          <SectionHeader title={t('report.courseMatches')} />
          <View style={styles.list}>
            {report.courseMatches.map((pairing, index) => (
              <CourseMatchCard
                key={`${pairing.homeCourse}-${index}`}
                pairing={pairing}
                sources={report.sources}
                equivalences={equivalences}
              />
            ))}
          </View>
        </View>
      )}

      {grouped.length > 0 && (
        <View>
          <SectionHeader title={t('report.requirements')} />
          <View style={styles.list}>
            {grouped.map((group) => (
              <Card key={group.category} style={styles.itemCard}>
                <Text variant="overline" color="violetPale">
                  {t(`report.categories.${group.category}`)}
                </Text>
                {group.items.map((requirement, index) => (
                  <View key={`${requirement.title}-${index}`} style={[styles.requirement, index > 0 && styles.separator]}>
                    <View style={styles.rowBetween}>
                      <Text variant="bodyStrong" style={styles.flexShrink}>
                        {requirement.title}
                      </Text>
                      <VerificationBadge item={requirement} />
                    </View>
                    <Text variant="callout" color="textSecondary">
                      {requirement.detail}
                    </Text>
                    <SourceChips ids={requirement.sourceIds} sources={report.sources} />
                  </View>
                ))}
              </Card>
            ))}
          </View>
        </View>
      )}

      {report.deadlines.length > 0 && (
        <View>
          <SectionHeader title={t('report.deadlines')} />
          <Card style={styles.itemCard}>
            {report.deadlines.map((deadline, index) => (
              <View key={`${deadline.title}-${index}`} style={[styles.requirement, index > 0 && styles.separator]}>
                <View style={styles.rowBetween}>
                  <View style={[styles.inline, styles.flexShrink]}>
                    <CalendarClock size={16} color={colors.amber} />
                    <Text variant="bodyStrong" style={styles.flexShrink}>
                      {deadline.date}
                    </Text>
                  </View>
                  <VerificationBadge item={deadline} />
                </View>
                <Text variant="callout" color="textSecondary">
                  {deadline.title}
                </Text>
                <SourceChips ids={deadline.sourceIds} sources={report.sources} />
              </View>
            ))}
          </Card>
        </View>
      )}

      {report.warnings.length > 0 && (
        <View>
          <SectionHeader title={t('report.warnings')} />
          <Card tone="amber" style={styles.itemCard}>
            {report.warnings.map((warning, index) => (
              <View key={index} style={styles.inlineTop}>
                <CircleAlert size={16} color={colors.amber} style={styles.bulletIcon} />
                <Text variant="callout" style={styles.flexShrink}>
                  {warning}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {report.sources.length > 0 && (
        <View>
          <SectionHeader title={t('report.sources')} />
          <Card style={styles.sourcesCard}>
            {report.sources.map((source, index) => (
              <Pressable
                key={source.id}
                onPress={() => openSource(source.url)}
                accessibilityRole="link"
                style={({ pressed }) => [styles.sourceRow, index > 0 && styles.separator, pressed && { opacity: 0.7 }]}>
                <Text variant="caption" color="violetPale" style={styles.sourceId}>
                  [{source.id}]
                </Text>
                <View style={styles.flexShrink}>
                  <Text variant="callout" numberOfLines={2}>
                    {source.title}
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {hostname(source.url)}
                    {source.academicYear ? ` · ${source.academicYear}` : ''}
                  </Text>
                  <View style={styles.sourceBadges}>
                    {source.kind !== 'other' && <Badge icon={ShieldCheck} tone="teal" label={t('report.official')} />}
                    {!source.retrieved && <Badge icon={FileText} tone="amber" label={t('report.notRetrieved')} />}
                  </View>
                </View>
                <ExternalLink size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <Card style={styles.inlineTop}>
        <Info size={18} color={colors.textMuted} style={styles.bulletIcon} />
        <Text variant="caption" color="textSecondary" style={[styles.flexShrink, styles.disclaimer]}>
          {t('report.disclaimer')}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  verifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemCard: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletIcon: {
    marginTop: 2,
  },
  flexShrink: {
    flexShrink: 1,
  },
  requirement: {
    gap: 6,
    paddingTop: spacing.sm,
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  sourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.violetSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourcesCard: {
    paddingVertical: spacing.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sourceId: {
    marginTop: 2,
    minWidth: 26,
  },
  sourceBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  disclaimer: {
    fontWeight: '500',
  },
});
