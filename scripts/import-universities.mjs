// Builds the university catalogue shipped with the app (src/data/universities.json,
// src/data/countries.json, src/data/departments.json) from three sources:
//   1. scripts/data/universities.curated.json — curated entries, Europe first (win on
//      conflicts): English name, city, website, email domains, type (university or
//      business school), departments, and whether the details were verified
//   2. Hipo "university-domains-list" (MIT licence) — ~10k universities worldwide with
//      their email domains, used for search and for university-email sign-in
//   3. The Erasmus Without Paper registry catalogue — official Erasmus codes for
//      European institutions (optional: skipped with a warning if unreachable)
//
// Usage: npm run import:universities [-- --world <file|url>] [-- --ewp <file|url>]
import { readFileSync, writeFileSync } from 'node:fs';

import { parseEwpCatalogue } from './lib/ewp.mjs';
import { COUNTRY_NAMES, destinationRank, ERASMUS_PROGRAMME, regionFor } from './lib/regions.mjs';

const WORLD_URL = 'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json';
const EWP_URL = 'https://registry.erasmuswithoutpaper.eu/catalogue-v1.xml';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};

async function load(source, as) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
    return as === 'json' ? response.json() : response.text();
  }
  const text = readFileSync(source, 'utf8');
  return as === 'json' ? JSON.parse(text) : text;
}

const root = new URL('..', import.meta.url);
const curated = JSON.parse(readFileSync(new URL('scripts/data/universities.curated.json', root), 'utf8'));
const world = await load(option('world', WORLD_URL), 'json');

let ewp = [];
try {
  ewp = parseEwpCatalogue(await load(option('ewp', EWP_URL), 'text'));
  console.log(`EWP registry: ${ewp.length} institutions with Erasmus codes`);
} catch (error) {
  console.warn(`EWP registry skipped (${error.message}); Erasmus codes will be missing.`);
}

const clean = (domain) => domain.trim().toLowerCase().replace(/^www\./, '');
const byDomain = new Map();
const entries = [];
const usedIds = new Set();

function add(entry) {
  entries.push(entry);
  usedIds.add(entry.id);
  for (const domain of entry.emailDomains) if (!byDomain.has(domain)) byDomain.set(domain, entry);
}

for (const u of curated) {
  add({ ...u, emailDomains: u.emailDomains.map(clean), featured: true, erasmusCode: null, verified: u.verified === true });
}

for (const u of world) {
  const domains = [...new Set(u.domains.map(clean))].filter(Boolean);
  if (domains.length === 0) continue;
  const existing = domains.map((d) => byDomain.get(d)).find(Boolean);
  if (existing) {
    // Same institution as a curated entry: keep the curated data, learn extra domains.
    for (const domain of domains) {
      if (!existing.emailDomains.includes(domain)) existing.emailDomains.push(domain);
      if (!byDomain.has(domain)) byDomain.set(domain, existing);
    }
    continue;
  }
  let id = domains[0];
  for (let n = 2; usedIds.has(id); n++) id = `${domains[0]}-${n}`;
  add({
    id,
    name: u.name.trim(),
    city: (u['state-province'] ?? '').trim(),
    countryCode: u.alpha_two_code.toUpperCase(),
    website: (u.web_pages[0] ?? `https://${domains[0]}`).replace(/^http:\/\//, 'https://').replace(/\/$/, ''),
    emailDomains: domains,
    featured: false,
    erasmusCode: null,
    verified: false,
  });
}

let ewpMatched = 0;
let ewpAdded = 0;
for (const hei of ewp) {
  const domain = clean(hei.schac);
  const existing = byDomain.get(domain);
  if (existing) {
    existing.erasmusCode ??= hei.erasmusCode;
    ewpMatched++;
  } else if (hei.countryCode && hei.name) {
    let id = domain;
    for (let n = 2; usedIds.has(id); n++) id = `${domain}-${n}`;
    add({
      id,
      name: hei.name,
      city: '',
      countryCode: hei.countryCode,
      website: `https://${domain}`,
      emailDomains: [domain],
      featured: false,
      erasmusCode: hei.erasmusCode,
      verified: false,
    });
    ewpAdded++;
  }
}
if (ewp.length) console.log(`EWP: ${ewpMatched} matched, ${ewpAdded} added`);

const countries = {};
const unmapped = new Set();
for (const entry of entries) {
  const code = entry.countryCode;
  const region = regionFor(code);
  if (!region) unmapped.add(code);
  const fromWorld = world.find((u) => u.alpha_two_code === code)?.country;
  countries[code] ??= [COUNTRY_NAMES[code] ?? fromWorld ?? code, region ?? 'europe', ERASMUS_PROGRAMME.has(code) ? 1 : 0];
}
if (unmapped.size) console.warn(`No region for: ${[...unmapped].join(', ')} (defaulted to europe)`);

// Europe first, then Canada, Australia, other countries and the US; curated entries
// first within each, then alphabetical. The app shows this order by default.
const rank = (e) => destinationRank(regionFor(e.countryCode) ?? 'europe', e.countryCode);
entries.sort((a, b) => rank(a) - rank(b) || Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));

// Compact tuples keep the bundled catalogue small:
// [id, name, countryCode, city, website, "domain1 domain2", erasmusCode, featured, businessSchool, verified]
const rows = entries.map((e) => [
  e.id,
  e.name,
  e.countryCode,
  e.city,
  e.website,
  e.emailDomains.join(' '),
  e.erasmusCode ?? '',
  e.featured ? 1 : 0,
  e.type === 'business_school' ? 1 : 0,
  e.verified ? 1 : 0,
]);

// Departments of curated entries: { universityId: [[name, kind], ...] }.
const departments = Object.fromEntries(
  curated.filter((u) => u.departments?.length).map((u) => [u.id, u.departments.map((d) => [d.name, d.kind])]),
);

writeFileSync(new URL('src/data/universities.json', root), JSON.stringify(rows));
writeFileSync(new URL('src/data/departments.json', root), JSON.stringify(departments));
writeFileSync(new URL('src/data/countries.json', root), JSON.stringify(Object.fromEntries(Object.entries(countries).sort())));
console.log(`Wrote ${rows.length} universities in ${Object.keys(countries).length} countries`);
