import assert from 'node:assert/strict';
import { test } from 'node:test';

import { destinationRank as appRank } from '../../src/lib/destination-order.ts';
import { destinationRank, regionFor } from './regions.mjs';

test('the importer orders destinations like the app: Europe, Canada, Australia, others, US', () => {
  for (const code of ['IT', 'GB', 'IE', 'CH', 'NO', 'CA', 'AU', 'NZ', 'SG', 'BR', 'ZA', 'US']) {
    const region = regionFor(code);
    assert.equal(destinationRank(region, code), appRank({ region, countryCode: code }), code);
  }
  const order = ['US', 'SG', 'AU', 'CA', 'DE', 'GB'].sort((a, b) => destinationRank(regionFor(a), a) - destinationRank(regionFor(b), b));
  assert.deepEqual(order, ['DE', 'GB', 'CA', 'AU', 'SG', 'US']);
});
