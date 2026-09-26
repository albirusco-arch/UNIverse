import { router } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { Text } from '@/components/ui';
import { getWallet, listFeaturePrices } from '@/data/api';
import type { AiFeature } from '@/data/types';
import { t } from '@/i18n';
import { useQuery } from '@/lib/use-query';
import { colors, radius } from '@/theme/tokens';

/** Balance pill for screen headers; opens the token screen. */
export function TokenBadge() {
  const { data: wallet } = useQuery(getWallet, []);
  return (
    <Pressable
      onPress={() => router.push('/wallet')}
      accessibilityRole="button"
      accessibilityLabel={`${t('wallet.title')}: ${t('wallet.tokens', { n: wallet?.balance ?? 0 })}`}
      hitSlop={6}
      style={({ pressed }) => [styles.badge, pressed && { opacity: 0.8 }]}>
      <Coins size={14} color={colors.amber} strokeWidth={2.4} />
      <Text variant="caption" style={styles.badgeText}>
        {wallet?.balance ?? '–'}
      </Text>
    </Pressable>
  );
}

/** "2 tokens" chip next to a paid action. */
export function TokenCost({ cost }: { cost: number }) {
  return (
    <View style={styles.cost}>
      <Coins size={12} color={colors.amber} strokeWidth={2.4} />
      <Text variant="caption" color="amber">
        {cost === 0 ? t('wallet.free') : t('wallet.cost', { n: cost })}
      </Text>
    </View>
  );
}

/** Price of a feature, from the server (demo: local table). */
export function useFeatureCost(feature: AiFeature): number | null {
  const { data } = useQuery(listFeaturePrices, []);
  return data?.find((price) => price.feature === feature)?.cost ?? null;
}

/** Shows "Not enough tokens" with a shortcut to buy more. */
export function useNotEnoughTokens() {
  const { showSheet } = useFeedback();
  return useCallback(
    async (feature: AiFeature) => {
      const [wallet, prices] = await Promise.all([getWallet(), listFeaturePrices()]);
      const cost = prices.find((p) => p.feature === feature)?.cost ?? 0;
      showSheet({
        title: t('wallet.notEnoughTitle'),
        message: t('wallet.notEnoughBody', { cost: t('wallet.cost', { n: cost }), balance: t('wallet.tokens', { n: wallet.balance }) }),
        options: [{ label: t('wallet.getTokens'), onPress: () => router.push('/wallet') }],
      });
    },
    [showSheet],
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  badgeText: {
    color: colors.amber,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
