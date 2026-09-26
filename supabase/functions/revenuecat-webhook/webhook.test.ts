import assert from 'node:assert/strict';
import { test } from 'node:test';

import { handleEvent, isAuthorized, userIdFor, type LedgerStore } from './webhook.ts';

const USER = '0b0d4c52-2f6e-4a4a-9d1e-3f6b1c2d4e5f';

/** In-memory ledger with the same idempotency rules as the database functions. */
function memoryStore() {
  const purchases = new Map<string, { user: string; tokens: number }>();
  const refunded = new Set<string>();
  const reversed = new Set<string>();
  const tokens: Record<string, number> = { universe_tokens_10: 10, universe_tokens_30: 30 };
  const store: LedgerStore = {
    async grantPurchase(user, product, tx) {
      if (!tokens[product] || purchases.has(tx)) return 0;
      purchases.set(tx, { user, tokens: tokens[product] });
      return tokens[product];
    },
    async refundPurchase(tx) {
      if (!purchases.has(tx) || refunded.has(tx)) return 0;
      refunded.add(tx);
      return 1;
    },
    async reverseRefund(tx) {
      if (!refunded.has(tx) || reversed.has(tx)) return 0;
      reversed.add(tx);
      return 1;
    },
  };
  const balance = (user: string) => {
    let total = 0;
    for (const [tx, p] of purchases) {
      if (p.user !== user) continue;
      total += p.tokens;
      if (refunded.has(tx)) total -= p.tokens;
      if (reversed.has(tx)) total += p.tokens;
    }
    return total;
  };
  return { store, balance };
}

const purchase = (tx: string, extra: Record<string, unknown> = {}) => ({
  type: 'NON_RENEWING_PURCHASE',
  app_user_id: USER,
  product_id: 'universe_tokens_10',
  transaction_id: tx,
  environment: 'PRODUCTION',
  ...extra,
});

test('credits a token pack once per transaction', async () => {
  const { store, balance } = memoryStore();
  assert.deepEqual(await handleEvent(purchase('tx-1'), store), { action: 'granted', tokens: 10 });
  assert.deepEqual(await handleEvent(purchase('tx-1'), store), { action: 'not_credited' });
  assert.equal(balance(USER), 10);
});

test('finds the student behind an anonymous RevenueCat id', async () => {
  assert.equal(userIdFor({ app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', USER] }), USER);
  assert.equal(userIdFor({ app_user_id: '$RCAnonymousID:abc' }), null);
  const { store } = memoryStore();
  assert.deepEqual(await handleEvent(purchase('tx-2', { app_user_id: '$RCAnonymousID:x' }), store), {
    action: 'ignored',
    reason: 'no_user',
  });
});

test('refunds remove the tokens and reversed refunds restore them', async () => {
  const { store, balance } = memoryStore();
  await handleEvent(purchase('tx-3'), store);
  assert.deepEqual(await handleEvent({ type: 'CANCELLATION', transaction_id: 'tx-3' }, store), { action: 'refunded' });
  assert.equal(balance(USER), 0);
  assert.deepEqual(await handleEvent({ type: 'CANCELLATION', transaction_id: 'tx-3' }, store), {
    action: 'ignored',
    reason: 'not_a_token_purchase',
  });
  assert.deepEqual(await handleEvent({ type: 'REFUND_REVERSED', transaction_id: 'tx-3' }, store), { action: 'restored' });
  assert.equal(balance(USER), 10);
});

test('ignores unknown products and other event types', async () => {
  const { store, balance } = memoryStore();
  assert.deepEqual(await handleEvent(purchase('tx-4', { product_id: 'something_else' }), store), { action: 'not_credited' });
  assert.equal((await handleEvent({ type: 'TEST' }, store)).action, 'ignored');
  assert.equal((await handleEvent({ type: 'INITIAL_PURCHASE', app_user_id: USER }, store)).action, 'ignored');
  assert.equal(balance(USER), 0);
});

test('checks the Authorization header', () => {
  assert.equal(isAuthorized('Bearer s3cret', 's3cret'), true);
  assert.equal(isAuthorized('Bearer s3cret', 'Bearer s3cret'), true);
  assert.equal(isAuthorized('Bearer wrong', 's3cret'), false);
  assert.equal(isAuthorized(null, 's3cret'), false);
  assert.equal(isAuthorized('Bearer s3cret', undefined), false);
});
