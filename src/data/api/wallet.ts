/**
 * Tokens: balance, history, prices of the paid AI features, and buying token
 * packs (consumable in-app purchases credited by the revenuecat-webhook function).
 */
import { buyProduct, storePrices } from '@/lib/purchases';

import type { AiFeature, FeaturePrice, LedgerEntry, TokenProduct, Wallet } from '../types';

import { currentUserId, InsufficientTokensError, isDemoMode, notifyChange, requireClient } from './core';
import { demo } from './demo-store';

export function demoBalance(): number {
  return demo.ledger.reduce((sum, entry) => sum + entry.delta, 0);
}

/** Demo mode: charge a feature like spend_tokens does on the server. */
export function demoSpend(feature: AiFeature) {
  const cost = demo.prices.find((p) => p.feature === feature)?.cost ?? 0;
  if (cost === 0) return;
  if (demoBalance() < cost) throw new InsufficientTokensError('insufficient tokens');
  demo.ledger.unshift({ id: `l-${Date.now()}`, delta: -cost, reason: 'spend', feature, createdAt: new Date().toISOString() });
}

type LedgerRow = { id: string; delta: number; reason: LedgerEntry['reason']; feature: AiFeature | null; created_at: string };

export async function getWallet(): Promise<Wallet> {
  if (isDemoMode) return { balance: demoBalance(), entries: [...demo.ledger] };
  if (!(await currentUserId())) return { balance: 0, entries: [] };
  const client = requireClient();
  const [balance, ledger] = await Promise.all([
    client.rpc('my_token_balance'),
    client.from('token_ledger').select('id, delta, reason, feature, created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  if (balance.error) throw balance.error;
  if (ledger.error) throw ledger.error;
  return {
    balance: balance.data as number,
    entries: (ledger.data as LedgerRow[]).map((row) => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      feature: row.feature,
      createdAt: row.created_at,
    })),
  };
}

export async function listFeaturePrices(): Promise<FeaturePrice[]> {
  if (isDemoMode) return demo.prices;
  const { data, error } = await requireClient().from('ai_features').select('feature, cost, free_per_day');
  if (error) throw error;
  return (data as { feature: AiFeature; cost: number; free_per_day: number }[]).map((row) => ({
    feature: row.feature,
    cost: row.cost,
    freePerDay: row.free_per_day,
  }));
}

/** Token packs with their store prices (prices are null when the store is not available). */
export async function listTokenProducts(): Promise<TokenProduct[]> {
  if (isDemoMode) return demo.products.map((p) => ({ ...p, priceString: null }));
  const { data, error } = await requireClient()
    .from('token_products')
    .select('product_id, tokens')
    .order('sort_order');
  if (error) throw error;
  const rows = data as { product_id: string; tokens: number }[];
  const prices = await storePrices(rows.map((r) => r.product_id)).catch(() => ({}) as Record<string, string>);
  return rows.map((row) => ({ productId: row.product_id, tokens: row.tokens, priceString: prices[row.product_id] ?? null }));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Buys a token pack. The store confirms the payment on the device; the tokens
 * arrive a few seconds later through the webhook, so poll the balance briefly.
 */
export async function buyTokens(product: TokenProduct): Promise<void> {
  if (isDemoMode) {
    demo.ledger.unshift({
      id: `l-${Date.now()}`,
      delta: product.tokens,
      reason: 'purchase',
      feature: null,
      createdAt: new Date().toISOString(),
    });
    notifyChange();
    return;
  }
  const before = (await getWallet()).balance;
  await buyProduct(product.productId);
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(1500);
    if ((await getWallet()).balance > before) break;
  }
  notifyChange();
}
