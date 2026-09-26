import type { Field } from '../data/types';

/**
 * Subject areas use ISCED-F 2013 (UNESCO), the classification Erasmus+
 * agreements use: 2 digits for a broad field ("04"), 3 for a narrow field
 * ("041") and 4 for a detailed field ("0413").
 */
export const ISCED_BROAD = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'] as const;

/** Subject areas for each field of study in the student profile. */
export const FIELD_ISCED: Record<Field, string[]> = {
  life_sciences: ['051'],
  biochemistry: ['0512'],
  medicine: ['0912'],
  computer_science: ['061'],
  engineering: ['071'],
  business: ['041', '0311'],
  law: ['042'],
  physics_math: ['053', '054'],
  humanities: ['022', '023'],
  social_sciences: ['031'],
  architecture: ['073'],
  other: [],
};

export function isIscedCode(code: string): boolean {
  return /^[0-9]{2}([0-9]{1,2})?$/.test(code);
}

/** Codes overlap when one contains the other: "04" covers "041", "0413" is part of "041". */
export function iscedOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * How an agreement's subject areas relate to the subjects a student wants:
 * "open" when the agreement lists none (all subjects, or not stated), "match"
 * when they overlap, "none" otherwise. No wanted subjects means anything goes.
 */
export function subjectCoverage(agreementCodes: string[], wanted: string[]): 'open' | 'match' | 'none' {
  if (agreementCodes.length === 0) return 'open';
  if (wanted.length === 0) return 'match';
  return agreementCodes.some((code) => wanted.some((w) => iscedOverlap(code, w))) ? 'match' : 'none';
}
