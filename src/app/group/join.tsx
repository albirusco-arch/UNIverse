import { router } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Input, Screen, Text } from '@/components/ui';
import { InvalidInviteCodeError, joinGroupWithCode } from '@/data/api';
import { t } from '@/i18n';
import { spacing } from '@/theme/tokens';

export default function JoinGroupScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = code.length === 8;

  const submit = async () => {
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      const id = await joinGroupWithCode(code);
      router.dismiss();
      router.push({ pathname: '/group/[id]', params: { id } });
    } catch (err) {
      setError(err instanceof InvalidInviteCodeError ? t('groups.invalidCode') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<Header title={t('groups.joinTitle')} modal />}
      footer={<Button title={t('groups.joinSubmit')} icon={KeyRound} onPress={submit} loading={busy} disabled={!valid} />}>
      <Text variant="callout" color="textSecondary">
        {t('groups.joinBody')}
      </Text>
      <View style={styles.form}>
        <Input
          label={t('groups.code')}
          value={code}
          onChangeText={(value) => setCode(value.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8))}
          placeholder="A1B2C3D4"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          style={styles.code}
          onSubmitEditing={submit}
        />
        {error && (
          <Text variant="callout" color="red" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  code: {
    fontSize: 22,
    letterSpacing: 6,
    fontWeight: '700',
  },
});
