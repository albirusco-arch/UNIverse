import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { requireAccount } from '@/components/account-gate';
import { useFeedback } from '@/components/feedback';
import { Button, Chip, ChipScroller, Header, Input, Screen, Text } from '@/components/ui';
import { createMoment, listClubs } from '@/data/api';
import type { Club } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

type Photo = { uri: string; mimeType: string };

// Photos are shared as they are (no filters, like BeReal), resized by the picker's quality setting.
const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [3, 4],
  quality: 0.6,
};

function toPhoto(result: ImagePicker.ImagePickerResult): Photo | null {
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

/** Clubs of the student's home and destination universities, for tagging the moment. */
async function myClubs(universityIds: string[]): Promise<Club[]> {
  const lists = await Promise.all(universityIds.map((id) => listClubs(id)));
  return lists.flat();
}

function NewMomentScreen() {
  const params = useLocalSearchParams<{ clubId?: string }>();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState('');
  const [clubId, setClubId] = useState<string | null>(params.clubId ?? null);
  const [publishing, setPublishing] = useState(false);

  const universityIds = [profile.homeUniversityId, profile.destinationId].filter((id): id is string => Boolean(id));
  const { data: clubs } = useQuery(() => myClubs(universityIds), [universityIds.join()]);
  const club = clubs?.find((c) => c.id === clubId) ?? null;

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      toast(t('moments.cameraDenied'));
      return;
    }
    const picked = toPhoto(await ImagePicker.launchCameraAsync(pickerOptions));
    if (picked) setPhoto(picked);
  };

  const choosePhoto = async () => {
    const picked = toPhoto(await ImagePicker.launchImageLibraryAsync(pickerOptions));
    if (picked) setPhoto(picked);
  };

  const publish = async () => {
    if (!photo) {
      toast(t('moments.needPhoto'));
      return;
    }
    setPublishing(true);
    try {
      const id = await createMoment({
        imageUri: photo.uri,
        mimeType: photo.mimeType,
        caption: caption.trim(),
        clubId: club?.id ?? null,
        clubName: club?.name ?? null,
        universityId: club?.universityId ?? profile.destinationId ?? profile.homeUniversityId,
      });
      router.replace({ pathname: '/moment/[id]', params: { id } });
    } catch (error) {
      toast(String((error as { message?: string }).message ?? '').includes('moment_limit') ? t('moments.limit') : t('common.error'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('moments.newTitle')} modal />}
      footer={<Button title={t('moments.publish')} icon={Send} onPress={publish} loading={publishing} disabled={!photo} />}>
      <View style={styles.form}>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
            <Button title={t('moments.changePhoto')} variant="ghost" size="sm" onPress={choosePhoto} />
          </View>
        ) : (
          <View style={styles.pick}>
            {Platform.OS !== 'web' && <Button title={t('moments.takePhoto')} icon={Camera} onPress={takePhoto} />}
            <Button
              title={t('moments.choosePhoto')}
              icon={ImageIcon}
              variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
              onPress={choosePhoto}
            />
          </View>
        )}

        <Input
          label={t('moments.caption')}
          value={caption}
          onChangeText={setCaption}
          placeholder={t('moments.captionPlaceholder')}
          maxLength={140}
        />

        {clubs && clubs.length > 0 ? (
          <View>
            <Text variant="overline" color="textMuted" style={styles.label}>
              {t('moments.club')}
            </Text>
            <ChipScroller>
              <Chip label={t('moments.noClub')} selected={clubId === null} onPress={() => setClubId(null)} />
              {clubs.map((c) => (
                <Chip key={c.id} label={c.name} selected={clubId === c.id} onPress={() => setClubId(c.id)} />
              ))}
            </ChipScroller>
          </View>
        ) : null}

        <Text variant="caption" color="textMuted">
          {t('moments.visibleFor')}
        </Text>
      </View>
    </Screen>
  );
}

export default requireAccount(NewMomentScreen, 'moments');

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  pick: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceStrong,
  },
  label: {
    marginBottom: 10,
  },
});
