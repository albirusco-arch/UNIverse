import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Header, Screen, Text } from '@/components/ui';
import { locale } from '@/i18n';
import { getLegalDoc, type LegalDocId } from '@/legal/documents';
import { spacing } from '@/theme/tokens';

const DOCS: LegalDocId[] = ['terms', 'privacy', 'guidelines'];

export default function LegalScreen() {
  const params = useLocalSearchParams<{ doc: string }>();
  const id = DOCS.includes(params.doc as LegalDocId) ? (params.doc as LegalDocId) : 'terms';
  const doc = getLegalDoc(id, locale);

  return (
    <Screen header={<Header title={doc.title} />}>
      <Badge label={doc.updated} tone="amber" />
      <View style={styles.sections}>
        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text variant="title3">{section.heading}</Text>
            <Text variant="body" color="textSecondary">
              {section.body}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
});
