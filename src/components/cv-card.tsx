import * as DocumentPicker from 'expo-document-picker';
import { FileText, FileUp, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Button, Card, Text } from '@/components/ui';
import { deleteCv, MAX_CV_BYTES, uploadCv } from '@/data/api';
import type { CvFile } from '@/data/types';
import { t } from '@/i18n';
import { formatDate, formatFileSize } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

/** The student's CV: upload, replace or remove (PDF, private storage). */
export function CvCard({ cv }: { cv: CvFile | null | undefined }) {
  const { toast, showSheet } = useFeedback();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.mimeType && asset.mimeType !== 'application/pdf') return toast(t('cv.notPdf'));
    const size = asset.size ?? asset.file?.size ?? 0;
    if (size > MAX_CV_BYTES) return toast(t('cv.tooLarge'));
    setBusy(true);
    try {
      await uploadCv({ uri: asset.uri, name: asset.name, size });
    } catch {
      toast(t('cv.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    showSheet({
      title: t('cv.remove'),
      message: t('cv.removeConfirm'),
      options: [
        {
          label: t('cv.remove'),
          destructive: true,
          onPress: () => {
            deleteCv().catch(() => toast(t('common.error')));
          },
        },
      ],
    });

  if (!cv) {
    return (
      <Card style={styles.card}>
        <Text variant="callout" color="textSecondary">
          {t('cv.noCv')}
        </Text>
        <Button title={t('cv.upload')} icon={FileUp} onPress={pick} loading={busy} />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.file}>
        <View style={styles.fileIcon}>
          <FileText size={22} color={colors.primaryLight} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {cv.fileName}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('cv.uploaded', { date: formatDate(cv.uploadedAt) })} · {formatFileSize(cv.sizeBytes)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button title={t('cv.replace')} icon={FileUp} variant="secondary" size="sm" onPress={pick} loading={busy} style={styles.flex} />
        <Button title={t('cv.remove')} icon={Trash2} variant="ghost" size="sm" onPress={remove} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    gap: spacing.md,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
