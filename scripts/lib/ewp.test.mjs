import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countryFromErasmusCode, parseEwpCatalogue } from './ewp.mjs';

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue xmlns="https://github.com/erasmus-without-paper/ewp-specs-api-registry/tree/stable-v1">
  <institutions>
    <hei id="unimi.it">
      <other-id type="pic">999881846</other-id>
      <other-id type="erasmus">I  MILANO01</other-id>
      <name xml:lang="it">Università degli Studi di Milano</name>
      <name xml:lang="en">University of Milan</name>
    </hei>
    <hei id="uni-heidelberg.de">
      <other-id type="erasmus">D  HEIDELB01</other-id>
      <name>Ruprecht-Karls-Universit&#228;t Heidelberg &amp; Co</name>
    </hei>
    <hei id="no-erasmus.example">
      <name xml:lang="en">No Erasmus code</name>
    </hei>
  </institutions>
</catalogue>`;

test('parses institutions with Erasmus codes', () => {
  const heis = parseEwpCatalogue(fixture);
  assert.equal(heis.length, 2);
  assert.deepEqual(heis[0], { schac: 'unimi.it', erasmusCode: 'I MILANO01', name: 'University of Milan', countryCode: 'IT' });
  assert.equal(heis[1].countryCode, 'DE');
  assert.equal(heis[1].name, 'Ruprecht-Karls-Universität Heidelberg & Co');
});

test('maps Erasmus code prefixes to ISO countries', () => {
  assert.equal(countryFromErasmusCode('SF HELSINK01'), 'FI');
  assert.equal(countryFromErasmusCode('UK LONDON029'), 'GB');
  assert.equal(countryFromErasmusCode('XX NOWHERE01'), null);
});
