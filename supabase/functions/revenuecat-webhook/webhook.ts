/**
 * RevenueCat webhook handling for consumable token packs. Pure logic so it can
 * be unit-tested; index.ts wires it to the database.
 *
 * Events used: NON_RENEWING_PURCHASE (credit tokens), CANCELLATION (a refund of
 * the purchase: remove them) and REFUND_REVERSED (give them back). Everything
 * is keyed by the store transaction id, so retried deliveries are harmless.
 */

export type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  transaction_id?: string | null;
  environment?: string | null;
};

export type LedgerStore = {
  grantPurchase(userId: string, productId: string, transactionId: string, environment: string): Promise<number>;
  refundPurchase(transactionId: string): Promise<number>;
  reverseRefund(transactionId: string): Promise<number>;
};

export type Outcome =
  | { action: 'granted'; tokens: number }
  // Already credited (retried delivery) or not a token product.
  | { action: 'not_credited' }
  | { action: 'refunded' }
  | { action: 'restored' }
  | { action: 'ignored'; reason: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The app logs in to RevenueCat with the Supabase user id, but a purchase made
 * before login is attached to an anonymous id; the real id is then an alias.
 */
export function userIdFor(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => typeof id === 'string' && UUID.test(id)) ?? null;
}

/** Constant-time comparison of the Authorization header with the configured secret. */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const expected = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function handleEvent(event: RevenueCatEvent, store: LedgerStore): Promise<Outcome> {
  const transactionId = event.transaction_id ?? '';
  switch (event.type) {
    case 'NON_RENEWING_PURCHASE': {
      const userId = userIdFor(event);
      if (!userId) return { action: 'ignored', reason: 'no_user' };
      if (!event.product_id || !transactionId) return { action: 'ignored', reason: 'incomplete_event' };
      const tokens = await store.grantPurchase(userId, event.product_id, transactionId, event.environment ?? '');
      return tokens > 0 ? { action: 'granted', tokens } : { action: 'not_credited' };
    }
    case 'CANCELLATION': {
      // For one-time purchases a cancellation is a refund; subscriptions are not sold.
      if (!transactionId) return { action: 'ignored', reason: 'incomplete_event' };
      return (await store.refundPurchase(transactionId)) > 0 ? { action: 'refunded' } : { action: 'ignored', reason: 'not_a_token_purchase' };
    }
    case 'REFUND_REVERSED': {
      if (!transactionId) return { action: 'ignored', reason: 'incomplete_event' };
      return (await store.reverseRefund(transactionId)) > 0 ? { action: 'restored' } : { action: 'ignored', reason: 'nothing_to_restore' };
    }
    default:
      return { action: 'ignored', reason: `event_${event.type ?? 'unknown'}` };
  }
}
