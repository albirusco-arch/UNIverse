import assert from 'node:assert/strict';
import { test } from 'node:test';

import en from './en.ts';
import it from './it.ts';

type Entry = string | readonly string[];

/** Flattens a dictionary into dot-separated keys. */
function flatten(value: unknown, prefix = '', out = new Map<string, Entry>()): Map<string, Entry> {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string' || Array.isArray(child)) out.set(path, child as Entry);
    else flatten(child, path, out);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const english = flatten(en);
const italian = flatten(it);

test('Italian has every English string', () => {
  const missing = [...english.keys()].filter((key) => !italian.has(key));
  assert.deepEqual(missing, []);
});

test('Italian has no extra strings except singular forms', () => {
  const extra = [...italian.keys()].filter((key) => !english.has(key) && !english.has(key.replace(/_one$/, '')));
  assert.deepEqual(extra, []);
});

test('translations keep the same placeholders', () => {
  for (const [key, value] of italian) {
    const source = english.get(key) ?? english.get(key.replace(/_one$/, ''));
    if (typeof value === 'string' && typeof source === 'string') {
      assert.deepEqual(placeholders(value), placeholders(source), key);
    } else {
      assert.equal(Array.isArray(value) && Array.isArray(source) && value.length === source.length, true, key);
    }
  }
});

test('no string is left empty', () => {
  for (const [key, value] of [...english, ...italian]) {
    if (typeof value === 'string') assert.notEqual(value.trim(), '', key);
  }
});
