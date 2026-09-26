/**
 * Premium features. Nothing is sold yet: no payment provider is connected, so
 * every premium feature is shown as locked ("Coming soon") and has no logic
 * behind it.
 *
 * To launch one: turn its flag on, make `hasEntitlement` ask the payment
 * provider, and check the entitlement again on the server before doing any
 * paid work.
 */
export type PremiumFeature = 'cv_analysis';

/** What the app shows for a premium feature. */
export type PremiumAccess = 'coming_soon' | 'locked' | 'available';

/** Build-time feature flags (EXPO_PUBLIC_FEATURE_*), off unless set to "1". */
export function isFeatureEnabled(feature: PremiumFeature): boolean {
  switch (feature) {
    case 'cv_analysis':
      return process.env.EXPO_PUBLIC_FEATURE_CV_ANALYSIS === '1';
  }
}

/**
 * Whether this user has bought `feature`. Stub: without a payment provider
 * nobody is entitled.
 */
export async function hasEntitlement(feature: PremiumFeature, userId: string | null): Promise<boolean> {
  void feature;
  void userId;
  return false;
}

export async function premiumAccess(feature: PremiumFeature, userId: string | null): Promise<PremiumAccess> {
  if (!isFeatureEnabled(feature)) return 'coming_soon';
  if (!userId || !(await hasEntitlement(feature, userId))) return 'locked';
  return 'available';
}
