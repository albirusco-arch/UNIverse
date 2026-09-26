/**
 * POST /functions/v1/revenuecat-webhook  (called by RevenueCat, not by the app)
 *
 * Credits token packs bought through the App Store / Google Play. Configure the
 * webhook in RevenueCat with the Authorization header value stored in the
 * REVENUECAT_WEBHOOK_AUTH secret. Deployed with verify_jwt = false.
 */
import { adminClient, json } from '../_shared/http.ts';
import { handleEvent, isAuthorized, type LedgerStore, type RevenueCatEvent } from './webhook.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isAuthorized(req.headers.get('Authorization'), Deno.env.get('REVENUECAT_WEBHOOK_AUTH'))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await req.json().catch(() => null);
  const event = body?.event as RevenueCatEvent | undefined;
  if (!event || typeof event !== 'object') return json({ error: 'invalid_body' }, 400);

  const admin = adminClient();
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw new Error(`${name}: ${error.message}`);
    return (data as number) ?? 0;
  };
  const store: LedgerStore = {
    grantPurchase: (userId, productId, transactionId, environment) =>
      rpc('grant_purchase', { p_user: userId, p_product: productId, p_transaction: transactionId, p_environment: environment }),
    refundPurchase: (transactionId) => rpc('refund_purchase', { p_transaction: transactionId }),
    reverseRefund: (transactionId) => rpc('reverse_refund', { p_transaction: transactionId }),
  };

  try {
    const outcome = await handleEvent(event, store);
    console.log(JSON.stringify({ event: 'revenuecat_webhook', id: event.id, type: event.type, outcome }));
    return json({ ok: true, outcome });
  } catch (error) {
    // A 5xx makes RevenueCat retry the delivery later.
    console.error(JSON.stringify({ event: 'revenuecat_webhook_failed', id: event.id, error: String(error) }));
    return json({ error: 'internal_error' }, 500);
  }
});
