import en, { type Dictionary } from './en';
import it from './it';

/**
 * English is the default; Italian is the second language. The active language
 * is set once at start-up (device language or the choice in Settings) by
 * LanguageProvider, which remounts the navigator when it changes.
 */
export const LANGUAGES = ['en', 'it'] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguagePreference = Language | 'system';

const dictionaries: Record<Language, Dictionary> = { en, it };
let active: Language = 'en';

export function getLanguage(): Language {
  return active;
}

export function setActiveLanguage(language: Language) {
  active = language;
}

/** The language to use for a preference, given the device's language code (e.g. "it"). */
export function resolveLanguage(preference: LanguagePreference, deviceLanguage: string | null | undefined): Language {
  if (preference !== 'system') return preference;
  return deviceLanguage?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

/** BCP 47 locale for dates and numbers in the active language. */
export function locale(): string {
  return active === 'it' ? 'it-IT' : 'en-GB';
}

/** Dot-separated paths to every string leaf of the dictionary. */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let value: unknown = dictionary;
  for (const part of key.split('.')) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * Translate `key`, replacing `{name}` placeholders. When `vars.n` is 1 and a
 * `<key>_one` string exists, that singular form is used ("1 member"). Falls
 * back to English if a string is missing.
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const dictionary = dictionaries[active];
  const singular = vars?.n === 1 ? `${key}_one` : null;
  let text =
    (singular ? (lookup(dictionary, singular) ?? lookup(en, singular)) : undefined) ??
    lookup(dictionary, key) ??
    lookup(en, key) ??
    key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return text;
}

/** Direct access for non-string entries such as lists. */
export function strings(): Dictionary {
  return dictionaries[active];
}
