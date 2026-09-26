import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hasEntitlement, isFeatureEnabled, premiumAccess } from './premium.ts';

test('CV analysis is coming soon unless its flag is on', async () => {
  delete process.env.EXPO_PUBLIC_FEATURE_CV_ANALYSIS;
  assert.equal(isFeatureEnabled('cv_analysis'), false);
  assert.equal(await premiumAccess('cv_analysis', 'user-1'), 'coming_soon');
});

test('with the flag on, nobody is entitled until a payment provider is connected', async () => {
  process.env.EXPO_PUBLIC_FEATURE_CV_ANALYSIS = '1';
  try {
    assert.equal(isFeatureEnabled('cv_analysis'), true);
    assert.equal(await hasEntitlement('cv_analysis', 'user-1'), false);
    assert.equal(await premiumAccess('cv_analysis', 'user-1'), 'locked');
    assert.equal(await premiumAccess('cv_analysis', null), 'locked');
  } finally {
    delete process.env.EXPO_PUBLIC_FEATURE_CV_ANALYSIS;
  }
});
