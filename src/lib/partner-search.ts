/**
 * Partner-first search: the exchange agreements of the student's home
 * university, narrowed by department or subject area, then by destination,
 * agreement type and language of instruction.
 */
import type { AgreementType, Partnership, Region, University } from '../data/types';
import { destinationRank } from './destination-order.ts';
import { subjectCoverage } from './isced.ts';

export type PartnerFilters = {
  /** Home department the student belongs to; agreements of other departments only count if the subject matches. */
  departmentId: string | null;
  /** ISCED codes of that department or of the student's field; empty = any subject. */
  subjects: string[];
  region: Region | 'all';
  country: string | null;
  agreement: AgreementType | 'all';
  /** ISO 639-1 code; agreements that do not state their languages are left out when set. */
  language: string | null;
};

export const NO_FILTERS: PartnerFilters = {
  departmentId: null,
  subjects: [],
  region: 'all',
  country: null,
  agreement: 'all',
  language: null,
};

/** department: owned by the student's department; subject: covers their subject; open: all subjects or not stated. */
export type SubjectFit = 'department' | 'subject' | 'open';

export type PartnerResult = { partnership: Partnership; university: University; fit: SubjectFit };

const FIT_ORDER: Record<SubjectFit, number> = { department: 0, subject: 1, open: 2 };

/** Admin-confirmed first, then read from the official list, then student suggestions. */
export function trustRank(partnership: Pick<Partnership, 'verified' | 'source'>): number {
  if (partnership.verified) return 0;
  return partnership.source === 'student' ? 2 : 1;
}

function subjectFit(partnership: Partnership, filters: PartnerFilters): SubjectFit | null {
  const department = partnership.homeDepartment;
  if (filters.departmentId && department?.id === filters.departmentId) return 'department';
  const coverage = subjectCoverage(partnership.iscedCodes, filters.subjects);
  // Another department's agreement is only relevant when its subjects match.
  if (filters.departmentId && department) return coverage === 'match' && partnership.iscedCodes.length ? 'subject' : null;
  if (coverage === 'none') return null;
  return coverage === 'match' && filters.subjects.length ? 'subject' : 'open';
}

export function searchPartners(
  partnerships: Partnership[],
  filters: PartnerFilters,
  lookup: (id: string) => University | undefined,
): PartnerResult[] {
  const results: PartnerResult[] = [];
  for (const partnership of partnerships) {
    const university = lookup(partnership.partnerUniversityId);
    if (!university) continue;
    if (filters.region !== 'all' && university.region !== filters.region) continue;
    if (filters.country && university.countryCode !== filters.country) continue;
    if (filters.agreement !== 'all' && partnership.agreementType !== filters.agreement) continue;
    if (filters.language && !partnership.languages.includes(filters.language)) continue;
    const fit = subjectFit(partnership, filters);
    if (fit) results.push({ partnership, university, fit });
  }
  return results.sort(
    (a, b) =>
      FIT_ORDER[a.fit] - FIT_ORDER[b.fit] ||
      trustRank(a.partnership) - trustRank(b.partnership) ||
      destinationRank(a.university) - destinationRank(b.university) ||
      a.university.name.localeCompare(b.university.name),
  );
}

/** Countries and languages present in a list of agreements, for the filter chips (Europe first). */
export function filterOptions(partnerships: Partnership[], lookup: (id: string) => University | undefined) {
  const countries = new Map<string, University>();
  const languages = new Map<string, number>();
  for (const partnership of partnerships) {
    const university = lookup(partnership.partnerUniversityId);
    if (university && !countries.has(university.countryCode)) countries.set(university.countryCode, university);
    for (const language of partnership.languages) languages.set(language, (languages.get(language) ?? 0) + 1);
  }
  return {
    countries: [...countries.values()]
      .sort((a, b) => destinationRank(a) - destinationRank(b) || a.country.localeCompare(b.country))
      .map((u) => u.countryCode),
    languages: [...languages.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([code]) => code),
  };
}
