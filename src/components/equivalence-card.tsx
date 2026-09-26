import { ArrowDown, CircleCheck, CircleX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, Text } from '@/components/ui';
import type { Equivalence } from '@/data/types';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme/tokens';

function CourseLine({ name, ects, caption }: { name: string; ects: number | null; caption: string }) {
  return (
    <View style={styles.course}>
      <View style={styles.courseText}>
        <Text variant="bodyStrong">{name}</Text>
        <Text variant="caption" color="textMuted">
          {caption}
        </Text>
      </View>
      {ects !== null && <Badge label={t('common.ects', { n: ects })} />}
    </View>
  );
}

export function EquivalenceCard({ equivalence, destinationName }: { equivalence: Equivalence; destinationName: string }) {
  const e = equivalence;
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Badge
          icon={e.approved ? CircleCheck : CircleX}
          tone={e.approved ? 'success' : 'red'}
          label={e.approved ? t('equivalence.approved') : t('equivalence.rejected')}
        />
        <Text variant="caption" color="textMuted">
          {e.academicYear} · {e.submittedBy.displayName}
        </Text>
      </View>
      <CourseLine name={e.homeCourse} ects={e.homeEcts} caption={e.homeUniversity} />
      <ArrowDown size={16} color={colors.textMuted} style={styles.arrow} />
      <CourseLine name={e.destinationCourse} ects={e.destinationEcts} caption={destinationName} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  course: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  courseText: {
    flex: 1,
  },
  arrow: {
    marginLeft: 2,
  },
});
