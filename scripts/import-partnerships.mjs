// Turns a CSV of exchange agreements copied from an official partner list into
// SQL for the Supabase SQL editor (see scripts/lib/partnerships-csv.mjs for the
// columns). Rows are marked verified: only import lists you checked.
// Usage: npm run import:partnerships -- agreements.csv > agreements.sql
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { agreementsSql, createResolver, readAgreements } from './lib/partnerships-csv.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:partnerships -- <file.csv> > agreements.sql');
  process.exit(1);
}

const universities = JSON.parse(readFileSync(new URL('../src/data/universities.json', import.meta.url), 'utf8'));
const { agreements, errors } = readAgreements(readFileSync(file, 'utf8'), createResolver(universities));
if (errors.length) {
  console.error(`${errors.length} problem(s) in ${file}; nothing was generated:\n${errors.join('\n')}`);
  process.exit(1);
}
process.stdout.write(agreementsSql(agreements, { today: new Date().toISOString().slice(0, 10), origin: basename(file) }));
console.error(`${agreements.length} agreement(s) ready.`);
