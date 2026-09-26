// Region and Erasmus+ programme-country tables for the catalogue importer.

const REGIONS = {
  uk: 'GB IE',
  europe:
    'AD AL AM AT AZ BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GE GR HR HU IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA XK',
  north_america: 'US CA GL BM PR',
  latin_america:
    'MX GT BZ SV HN NI CR PA CU DO HT JM BS BB AG DM GD KN LC VC TT KY TC VG MS GP GF AR BO BR CL CO EC GY PY PE SR UY VE',
  middle_east: 'AE BH EG IQ IR IL JO KW LB OM PS QA SA SY YE',
  africa:
    'DZ AO BJ BW BF BI CM CV CF TD CD CG CI DJ GQ ER SZ ET GA GM GH GN KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RE RW SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW',
  asia: 'AF BD BT BN KH CN HK IN ID JP KZ KG LA MO MY MV MN MM NP KP KR PK PH SG LK TW TJ TH TL TM UZ VN',
  oceania: 'AU NZ FJ PG WS NC PF NU GU',
};

const regionByCountry = new Map(
  Object.entries(REGIONS).flatMap(([region, codes]) => codes.split(' ').map((code) => [code, region])),
);

export function regionFor(countryCode) {
  return regionByCountry.get(countryCode) ?? null;
}

// Erasmus+ programme countries (EU member states + Iceland, Liechtenstein, Norway,
// North Macedonia, Serbia and Türkiye). Everything else is "overseas" in the app.
export const ERASMUS_PROGRAMME = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO MK RS TR'.split(' '),
);

// Friendlier display names than the ISO long forms used by the source dataset.
export const COUNTRY_NAMES = {
  BO: 'Bolivia',
  BN: 'Brunei',
  CD: 'DR Congo',
  CZ: 'Czechia',
  KP: 'North Korea',
  KR: 'South Korea',
  LA: 'Laos',
  MD: 'Moldova',
  PS: 'Palestine',
  RU: 'Russia',
  SY: 'Syria',
  TR: 'Türkiye',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  VA: 'Vatican City',
  VE: 'Venezuela',
  VG: 'British Virgin Islands',
  VN: 'Vietnam',
};

// Europe first (including the UK, Ireland and Switzerland), then Canada, then
// Australia, then every other country, with the United States last. Mirrors
// src/lib/destination-order.ts (checked by regions.test.mjs).
export function destinationRank(region, countryCode) {
  if (region === 'europe' || region === 'uk') return 0;
  if (countryCode === 'CA') return 1;
  if (countryCode === 'AU') return 2;
  if (countryCode === 'US') return 4;
  return 3;
}
