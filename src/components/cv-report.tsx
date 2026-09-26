import { CircleAlert, CircleCheck, CircleX, Info, Quote, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ScoreBar, ScoreRing } from '@/components/score';
import { Badge, Card, SectionHeader, Text, type BadgeTone } from '@/components/ui';
import type { CvPriority, CvReport } from '@/data/types';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

const priorityTones: Record<CvPriority, BadgeTone> = { high: 'red', medium: 'amber', low: 'neutral' };

const atsIcons = {
  pass: { icon: CircleCheck, color: colors.success },
  warning: { icon: TriangleAlert, color: colors.amber },
  fail: { icon: CircleX, color: colors.red },
};

function Keyword({ label, missing }: { label: string; missing?: boolean }) {
  return (
    <View style={[styles.keyword, missing && styles.keywordMissing]}>
      <Text variant="caption" color={missing ? 'amber' : 'successLight'}>
        {label}
      </Text>
    </View>
  );
}

export function CvReportView({ report, isDemo = false }: { report: CvReport; isDemo?: boolean }) {
  return (
    <View style={styles.container}>
      {isDemo && (
        <Card tone="amber" style={styles.inline}>
          <Info size={18} color={colors.amber} />
          <Text variant="callout" style={styles.flex}>
            {t('cv.demoBanner')}
          </Text>
        </Card>
      )}

      <Card style={styles.scoreCard}>
        <ScoreRing score={report.overallScore} />
        <View style={styles.flex}>
          <Text variant="overline" color="textMuted">
            {t('cv.score')}
          </Text>
          <Text variant="callout" color="textSecondary">
            {report.summary}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('report.checkedOn', { date: formatDate(report.checkedAt) })}
          </Text>
        </View>
      </Card>

      {report.headline ? (
        <View>
          <SectionHeader title={t('cv.headline')} />
          <Card tone="primary" style={styles.inlineTop}>
            <Quote size={16} color={colors.primaryLight} style={styles.icon} />
            <Text variant="bodyStrong" style={styles.flex} selectable>
              {report.headline}
            </Text>
          </Card>
        </View>
      ) : null}

      {report.improvements.length > 0 && (
        <View>
          <SectionHeader title={t('cv.improvements')} />
          <View style={styles.list}>
            {report.improvements.map((item, index) => (
              <Card key={`${item.section}-${index}`} style={styles.item}>
                <View style={styles.rowBetween}>
                  <Text variant="overline" color="primaryPale">
                    {item.section}
                  </Text>
                  <Badge label={t(`cv.priorities.${item.priority}`)} tone={priorityTones[item.priority]} />
                </View>
                <Text variant="bodyStrong">{item.issue}</Text>
                <Text variant="callout" color="textSecondary">
                  {item.suggestion}
                </Text>
                {item.example ? (
                  <View style={styles.example}>
                    <Text variant="caption" color="textMuted">
                      {t('cv.example')}
                    </Text>
                    <Text variant="callout" selectable>
                      {item.example}
                    </Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        </View>
      )}

      {report.strengths.length > 0 && (
        <View>
          <SectionHeader title={t('cv.strengths')} />
          <Card style={styles.item}>
            {report.strengths.map((strength, index) => (
              <View key={index} style={styles.inlineTop}>
                <CircleCheck size={16} color={colors.success} style={styles.icon} />
                <Text variant="callout" style={styles.flex}>
                  {strength}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {report.sectionScores.length > 0 && (
        <View>
          <SectionHeader title={t('cv.sections')} />
          <Card style={styles.item}>
            {report.sectionScores.map((section) => (
              <View key={section.section} style={styles.sectionScore}>
                <ScoreBar label={section.section} value={section.score} />
                <Text variant="caption" color="textMuted">
                  {section.comment}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      {report.atsChecks.length > 0 && (
        <View>
          <SectionHeader title={t('cv.ats')} />
          <Card style={styles.item}>
            {report.atsChecks.map((check, index) => {
              const { icon: Icon, color } = atsIcons[check.status];
              return (
                <View key={index} style={styles.inlineTop}>
                  <Icon size={16} color={color} style={styles.icon} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{check.check}</Text>
                    <Text variant="caption" color="textMuted">
                      {check.detail}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {(report.keywords.present.length > 0 || report.keywords.missing.length > 0) && (
        <View>
          <SectionHeader title={t('cv.keywords')} />
          <Card style={styles.item}>
            {report.keywords.present.length > 0 && (
              <>
                <Text variant="caption" color="textMuted">
                  {t('cv.keywordsPresent')}
                </Text>
                <View style={styles.keywords}>
                  {report.keywords.present.map((keyword) => (
                    <Keyword key={keyword} label={keyword} />
                  ))}
                </View>
              </>
            )}
            {report.keywords.missing.length > 0 && (
              <>
                <Text variant="caption" color="textMuted">
                  {t('cv.keywordsMissing')}
                </Text>
                <View style={styles.keywords}>
                  {report.keywords.missing.map((keyword) => (
                    <Keyword key={keyword} label={keyword} missing />
                  ))}
                </View>
              </>
            )}
          </Card>
        </View>
      )}

      {report.nextSteps.length > 0 && (
        <View>
          <SectionHeader title={t('cv.nextSteps')} />
          <Card tone="success" style={styles.item}>
            {report.nextSteps.map((step, index) => (
              <View key={index} style={styles.inlineTop}>
                <Text variant="bodyStrong" color="successLight" style={styles.stepNumber}>
                  {index + 1}
                </Text>
                <Text variant="callout" style={styles.flex}>
                  {step}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}

      <Card style={styles.inlineTop}>
        <CircleAlert size={16} color={colors.textMuted} style={styles.icon} />
        <Text variant="caption" color="textSecondary" style={styles.flex}>
          {t('cv.privacy')}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxl,
  },
  flex: {
    flex: 1,
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
  icon: {
    marginTop: 2,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  item: {
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  example: {
    gap: 2,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sectionScore: {
    gap: 4,
    paddingVertical: 4,
  },
  keywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  keyword: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  keywordMissing: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amberBorder,
  },
  stepNumber: {
    width: 18,
  },
});
