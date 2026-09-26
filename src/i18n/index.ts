import en, { type Dictionary } from './en';

/** UNIVERSE ships in English. Strings stay in one dictionary so copy is easy to review. */
const dictionary: Dictionary = en;

/** Dot-separated paths to every string leaf of the dictionary. */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

function lookup(key: string): string | undefined {
  let value: unknown = dictionary;
  for (const part of key.split('.')) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * Translate `key`, replacing `{name}` placeholders. When `vars.n` is 1 and a
 * `<key>_one` string exists, that singular form is used ("1 member").
 */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let text = (vars?.n === 1 ? lookup(`${key}_one`) : undefined) ?? lookup(key) ?? key;
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
