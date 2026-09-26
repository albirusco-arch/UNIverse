/**
 * Personalisation signals: what the student searches, views, saves and
 * researches. They feed the "For you" ranking (src/lib/feed-ranking.ts) and are
 * private to the student.
 */
import type { Signal, SignalKind } from '../types';

import { currentUserId, isDemoGuest, isDemoMode, requireClient } from './core';
import { demo } from './demo-store';

const MAX_SIGNALS = 200;

/** Fire-and-forget: personalisation must never block or break the UI. */
export function trackSignal(kind: SignalKind, value: string) {
  const trimmed = value.trim().slice(0, 200);
  if (!trimmed || isDemoGuest()) return;
  if (isDemoMode) {
    demo.signals.unshift({ kind, value: trimmed, createdAt: new Date().toISOString() });
    demo.signals.length = Math.min(demo.signals.length, MAX_SIGNALS);
    return;
  }
  (async () => {
    const userId = await currentUserId();
    if (!userId) return;
    await requireClient().from('user_signals').insert({ user_id: userId, kind, value: trimmed });
  })().catch(() => undefined);
}

export async function listSignals(): Promise<Signal[]> {
  if (isDemoGuest()) return [];
  if (isDemoMode) return [...demo.signals];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient()
    .from('user_signals')
    .select('kind, value, created_at')
    .order('created_at', { ascending: false })
    .limit(MAX_SIGNALS);
  if (error) throw error;
  return (data as { kind: SignalKind; value: string; created_at: string }[]).map((row) => ({
    kind: row.kind,
    value: row.value,
    createdAt: row.created_at,
  }));
}
