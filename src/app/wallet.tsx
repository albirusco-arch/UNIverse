import { Coins, Info } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useFeedback } from '@/components/feedback';
import { TokenCost } from '@/components/tokens';
import { Button, Card, Divider, Header, Screen, SectionHeader, Text } from '@/components/ui';
import { buyTokens, getWallet, isDemoMode, listFeaturePrices, listTokenProducts } from '@/data/api';
import type { LedgerEntry, TokenProduct } from '@/data/types';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { PurchaseCancelledError, purchasesEnabled } from '@/lib/purchases';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

function entryLabel(entry: LedgerEntry): string {
  const reason = t(`wallet.reasons.${entry.reason}`);
  return entry.feature ? `${reason} · ${t(`wallet.features.${entry.feature}`)}` : reason;
}

function PackRow({ product, onBuy, busy }: { product: TokenProduct; onBuy: () => void; busy: boolean }) {
  const canBuy = isDemoMode || purchasesEnabled;
  return (
    <View style={styles.pack}>
      <View style={styles.packIcon}>
        <Coins size={20} color={colors.amber} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{t('wallet.tokens', { n: product.tokens })}</Text>
        {product.priceString ? (
          <Text variant="caption" color="textMuted">
            {product.priceString}
          </Text>
        ) : null}
      </View>
      <Button
        title={product.priceString ?? t('wallet.buy')}
        size="sm"
        onPress={onBuy}
        loading={busy}
        disabled={!canBuy}
        style={styles.buy}
      />
    </View>
  );
}

export default function WalletScreen() {
  const { toast } = useFeedback();
  const { data: wallet, loading } = useQuery(getWallet, []);
  const { data: prices } = useQuery(listFeaturePrices, []);
  const { data: products } = useQuery(listTokenProducts, []);
  const [buying, setBuying] = useState<string | null>(null);

  const buy = async (product: TokenProduct) => {
    setBuying(product.productId);
    const before = wallet?.balance ?? 0;
    try {
      await buyTokens(product);
      const after = (await getWallet()).balance;
      toast(after > before ? t('wallet.bought') : t('wallet.pending'));
    } catch (error) {
      if (!(error instanceof PurchaseCancelledError)) toast(t('common.error'));
    } finally {
      setBuying(null);
    }
  };

  return (
    <Screen header={<Header title={t('wallet.title')} />}>
      <Card tone="amber" style={styles.balance}>
        <Text variant="overline" color="textMuted">
          {t('wallet.balance')}
        </Text>
        <View style={styles.balanceRow}>
          <Coins size={30} color={colors.amber} />
          {wallet ? (
            <Text style={styles.balanceValue} accessibilityLabel={t('wallet.tokens', { n: wallet.balance })}>
              {wallet.balance}
            </Text>
          ) : loading ? (
            <ActivityIndicator color={colors.amber} />
          ) : null}
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t('wallet.pricesTitle')} />
        <Card style={styles.list}>
          {(prices ?? []).map((price, index) => (
            <View key={price.feature}>
              {index > 0 && <Divider />}
              <View style={styles.priceRow}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{t(`wallet.features.${price.feature}`)}</Text>
                  {price.freePerDay > 0 && (
                    <Text variant="caption" color="success">
                      {t('wallet.freeToday', { n: price.freePerDay })}
                    </Text>
                  )}
                </View>
                <TokenCost cost={price.cost} />
              </View>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('wallet.packsTitle')} />
        <Card style={styles.list}>
          {(products ?? []).map((product, index) => (
            <View key={product.productId}>
              {index > 0 && <Divider />}
              <PackRow product={product} onBuy={() => buy(product)} busy={buying === product.productId} />
            </View>
          ))}
        </Card>
        {(isDemoMode || !purchasesEnabled) && (
          <View style={styles.note}>
            <Info size={14} color={colors.textMuted} style={styles.noteIcon} />
            <Text variant="caption" color="textMuted" style={styles.flex}>
              {isDemoMode ? t('wallet.demoBuy') : t('wallet.storeOnly')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('wallet.historyTitle')} />
        {wallet && wallet.entries.length > 0 ? (
          <Card style={styles.list}>
            {wallet.entries.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && <Divider />}
                <View style={styles.priceRow}>
                  <View style={styles.flex}>
                    <Text variant="callout">{entryLabel(entry)}</Text>
                    <Text variant="caption" color="textMuted">
                      {formatDate(entry.createdAt)}
                    </Text>
                  </View>
                  <Text variant="bodyStrong" color={entry.delta > 0 ? 'success' : 'textSecondary'} style={styles.delta}>
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Text variant="callout" color="textMuted">
            {t('wallet.noHistory')}
          </Text>
        )}
      </View>

      <Text variant="caption" color="textMuted" style={styles.legal}>
        {t('wallet.legal')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  balance: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  section: {
    marginTop: spacing.xxl,
  },
  list: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  packIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buy: {
    minWidth: 96,
  },
  delta: {
    fontVariant: ['tabular-nums'],
  },
  note: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  noteIcon: {
    marginTop: 1,
  },
  legal: {
    marginTop: spacing.xxl,
  },
});
