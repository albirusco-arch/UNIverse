import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { UniversityPicker } from '@/components/university-picker';
import { Button, Chip, ChipRow, Header, Input, Screen, Text } from '@/components/ui';
import { createPost } from '@/data/api';
import { TOPICS, type Topic } from '@/data/types';
import { t } from '@/i18n';
import { useSession } from '@/lib/session';
import { spacing } from '@/theme/tokens';

const MIN_LENGTH = 10;

function isTopic(value: string | undefined): value is Topic {
  return TOPICS.includes(value as Topic);
}

export default function NewPostScreen() {
  const params = useLocalSearchParams<{ universityId?: string; topic?: string }>();
  const { profile } = useSession();
  const { toast } = useFeedback();
  const [topic, setTopic] = useState<Topic>(isTopic(params.topic) ? params.topic : 'question');
  const [universityId, setUniversityId] = useState<string | null>(params.universityId ?? null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    if (body.trim().length < MIN_LENGTH) {
      setError(t('compose.tooShort'));
      return;
    }
    setPublishing(true);
    try {
      const id = await createPost({ topic, body: body.trim(), universityId, field: profile.field });
      router.replace({ pathname: '/post/[id]', params: { id } });
    } catch {
      toast(t('common.error'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('compose.title')} modal />}
      footer={<Button title={t('compose.publish')} icon={Send} onPress={publish} loading={publishing} />}>
      <View style={styles.form}>
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('compose.topic')}
          </Text>
          <ChipRow>
            {TOPICS.map((option) => (
              <Chip key={option} label={t(`topics.${option}`)} selected={topic === option} onPress={() => setTopic(option)} />
            ))}
          </ChipRow>
        </View>
        <UniversityPicker
          label={t('compose.destination')}
          value={universityId}
          onChange={setUniversityId}
          placeholder={t('onboarding.destinationPlaceholder')}
        />
        <Input
          label={t('compose.body')}
          value={body}
          onChangeText={(text) => {
            setBody(text);
            if (error) setError(null);
          }}
          placeholder={t('compose.bodyPlaceholder')}
          multiline
          maxLength={4000}
          autoFocus
        />
        {error && (
          <Text variant="callout" color="red">
            {error}
          </Text>
        )}
        <Text variant="caption" color="textMuted" style={styles.guidelines}>
          {t('compose.guidelines')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.xl,
  },
  label: {
    marginBottom: 10,
  },
  guidelines: {
    fontWeight: '500',
  },
});
