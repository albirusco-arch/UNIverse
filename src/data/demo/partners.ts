/**
 * Demo partner lists. They are illustrative samples (flagged `sample`, shown
 * with a banner), never presented as real agreements.
 */
import type { AgreementType, Department, Partnership, PartnershipSource } from '../types';

const SAMPLE_URL = 'https://example.org/sample-partner-list';

const departments = [
  { key: 'bio', name: 'Biosciences', iscedCodes: ['051'] },
  { key: 'econ', name: 'Economics and Management', iscedCodes: ['041', '0311'] },
  { key: 'cs', name: 'Computer Science', iscedCodes: ['061'] },
] as const;

type Template = {
  partner: string;
  type: AgreementType;
  department: (typeof departments)[number]['key'] | null;
  isced: string[];
  languages: string[];
  level?: string;
  places: number | null;
  source: PartnershipSource;
};

const templates: Template[] = [
  { partner: 'heidelberg', type: 'erasmus', department: 'bio', isced: ['051'], languages: ['de', 'en'], level: 'B2', places: 2, source: 'admin' },
  { partner: 'uva', type: 'erasmus', department: 'econ', isced: ['041', '0311'], languages: ['en'], level: 'B2', places: 4, source: 'admin' },
  { partner: 'kuleuven', type: 'erasmus', department: null, isced: [], languages: ['en', 'nl'], places: 3, source: 'ai' },
  { partner: 'ucm', type: 'erasmus', department: 'bio', isced: ['05'], languages: ['es'], level: 'B1', places: 3, source: 'admin' },
  { partner: 'lu.se', type: 'erasmus', department: 'cs', isced: ['061'], languages: ['en', 'sv'], places: 2, source: 'ai' },
  { partner: 'copenhagen', type: 'erasmus', department: null, isced: ['051', '053'], languages: ['en', 'da'], places: 2, source: 'admin' },
  { partner: 'univie', type: 'erasmus', department: 'econ', isced: ['041'], languages: ['de', 'en'], level: 'B2', places: 2, source: 'ai' },
  { partner: 'tcd', type: 'erasmus', department: null, isced: [], languages: ['en'], places: 1, source: 'student' },
  { partner: 'ucl', type: 'other', department: null, isced: ['051'], languages: ['en'], places: null, source: 'ai' },
  { partner: 'utoronto', type: 'bilateral', department: null, isced: [], languages: ['en'], places: 2, source: 'admin' },
  { partner: 'mcgill', type: 'bilateral', department: 'bio', isced: ['051'], languages: ['en', 'fr'], places: 1, source: 'ai' },
  { partner: 'unimelb', type: 'bilateral', department: null, isced: [], languages: ['en'], places: 2, source: 'admin' },
  { partner: 'nus', type: 'bilateral', department: 'cs', isced: ['061'], languages: ['en'], places: 2, source: 'ai' },
  { partner: 'berkeley', type: 'bilateral', department: null, isced: [], languages: ['en'], places: 1, source: 'student' },
];

export function createDemoDepartments(homeId: string): Department[] {
  return departments.map((d) => ({
    id: `${homeId}-${d.key}`,
    universityId: homeId,
    name: d.name,
    kind: 'department',
    iscedCodes: [...d.iscedCodes],
    website: '',
    sourceUrl: SAMPLE_URL,
    verified: false,
  }));
}

/** Sample agreements for a home university; `fromAi` marks them all as read from an official list, to confirm. */
export function createDemoPartnerships(homeId: string, { fromAi = false } = {}): Partnership[] {
  const byKey = new Map(createDemoDepartments(homeId).map((d) => [d.id, d]));
  const checked = new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10);
  return templates
    .filter((item) => item.partner !== homeId)
    .map((item) => {
      const source: PartnershipSource = fromAi ? 'ai' : item.source;
      const department = item.department ? byKey.get(`${homeId}-${item.department}`) : undefined;
      return {
        id: `sample-${homeId}-${item.partner}`,
        homeUniversityId: homeId,
        partnerUniversityId: item.partner,
        agreementType: item.type,
        homeDepartment: department ? { id: department.id, name: department.name } : null,
        iscedCodes: item.isced,
        levels: ['bachelor', 'master'],
        languages: item.languages,
        languageLevel: item.level ?? '',
        places: item.places,
        academicYear: '2027/28',
        source,
        sourceUrl: SAMPLE_URL,
        verified: source === 'admin',
        lastVerified: source === 'student' ? null : checked,
        sample: true,
      };
    });
}
