/**
 * Token charges for paid AI features (see the token_ledger migration). The
 * edge functions charge before starting a job and refund if the job fails.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AiFeature = 'cv_review' | 'opportunity_match' | 'research';

export type Charge = { ok: true; balance: number } | { ok: false; error: 'insufficient_tokens' | 'charge_failed' };

export async function chargeTokens(admin: SupabaseClient, userId: string, feature: AiFeature, jobId: string): Promise<Charge> {
  const { data, error } = await admin.rpc('spend_tokens', { p_user: userId, p_feature: feature, p_job: jobId });
  if (error) {
    if (error.message.includes('insufficient_tokens')) return { ok: false, error: 'insufficient_tokens' };
    console.error(JSON.stringify({ event: 'charge_failed', feature, error: error.message }));
    return { ok: false, error: 'charge_failed' };
  }
  return { ok: true, balance: data as number };
}

/** Gives the tokens of a failed job back (idempotent). */
export async function refundJob(admin: SupabaseClient, jobId: string) {
  const { error } = await admin.rpc('refund_spend', { p_job: jobId });
  if (error) console.error(JSON.stringify({ event: 'refund_failed', jobId, error: error.message }));
}

/** Uses of a feature today that were free, and what the next one costs. */
export async function featurePrice(admin: SupabaseClient, feature: AiFeature): Promise<{ cost: number; freePerDay: number }> {
  const { data } = await admin.from('ai_features').select('cost, free_per_day').eq('feature', feature).maybeSingle();
  return { cost: data?.cost ?? 0, freePerDay: data?.free_per_day ?? 0 };
}
