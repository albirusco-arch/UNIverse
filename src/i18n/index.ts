import { getLocales } from 'expo-localization';

import en, { type Dictionary } from './en';
import it from './it';

const dictionaries = { en, it } satisfies Record<string, Dictionary>;
export type Locale = keyof typeof dictionaries;

function detectLocale(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'it' ? 'it' : 'en';
}

export const locale: Locale = detectLocale();
const dictionary: Dictionary = dictionaries[locale];

/** Dot-separated paths to every string leaf of the dictionary. */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let value: unknown = dictionary;
  for (const part of key.split('.')) {
    value = (value as Record<string, unknown>)[part];
  }
  let text = typeof value === 'string' ? value : key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return text;
}

/** Direct access for non-string entries such as lists. */
export function strings(): Dictionary {
  return dictionary;
}
