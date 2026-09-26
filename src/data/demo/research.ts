/**
 * Illustrative research reports for demo mode, one per research kind. They are
 * labelled as samples in the UI and only link to example.org, so nothing here
 * can be mistaken for real requirements.
 */
import type { Research, ResearchKind, ResearchReport, ResearchRequest, Source } from '../types';

const source = (id: number, title: string, kind: Source['kind'], retrieved = true): Source => ({
  id,
  url: `https://example.org/${title.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  title: `Example — ${title}`,
  kind,
  academicYear: '2026/27',
  retrieved,
});

const empty = { requirements: [], deadlines: [], steps: [], courseMatches: [], scholarships: [], warnings: [] };

const reports: Record<ResearchKind, Omit<ResearchReport, 'checkedAt'>> = {
  exchange: {
    ...empty,
    summary:
      'Sample report. In the live app every line is researched on official exchange pages and course catalogues, with a link to the exact source.',
    academicYear: '2026/27',
    officialPageUrl: 'https://example.org/exchange',
    sources: [
      source(1, 'Exchange students page', 'official_destination'),
      source(2, 'Module handbook', 'official_program'),
      source(3, 'Home university Erasmus call', 'official_home'),
      source(4, 'Student forum thread', 'other'),
    ],
    requirements: [
      { category: 'language', title: 'Language certificate', detail: 'Example: a minimum level in the language of the courses you pick.', sourceIds: [1], verified: true },
      { category: 'credits', title: 'Course load', detail: 'Example: around 30 ECTS per semester; your home university may set its own minimum.', sourceIds: [3], verified: true },
      { category: 'financial', title: 'Erasmus+ grant', detail: 'Example: the monthly amount depends on the destination country.', sourceIds: [4], verified: false },
    ],
    deadlines: [{ title: 'Example — application at the destination', date: '15 May', sourceIds: [1], verified: true }],
    courseMatches: [
      { homeCourse: 'Biochemistry II', homeEcts: 6, destinationCourse: 'Molecular Biochemistry', destinationCode: 'EX-101', destinationEcts: 6, semester: 'Winter', language: 'English', url: 'https://example.org/module-handbook', fit: 'strong', rationale: 'Example: both cover enzyme kinetics, metabolism and protein structure.', sourceIds: [2], verified: true },
      { homeCourse: 'Genetics', homeEcts: 8, destinationCourse: '', destinationCode: '', destinationEcts: null, semester: '', language: '', url: '', fit: 'none', rationale: 'Example: no course with matching content in this term’s catalogue.', sourceIds: [], verified: false },
    ],
    warnings: ['Example: ask your coordinator whether a partial match can be approved.'],
  },
  admission: {
    ...empty,
    summary: 'Sample report. Live reports list the programme’s official entry requirements for your qualification and citizenship.',
    academicYear: '2027/28',
    officialPageUrl: 'https://example.org/admissions',
    sources: [source(1, 'Programme admission page', 'official_destination'), source(2, 'Qualification recognition', 'official_government')],
    requirements: [
      { category: 'academic', title: 'Prior degree', detail: 'Example: a bachelor’s degree in a related field with a minimum grade.', sourceIds: [1], verified: true },
      { category: 'language', title: 'English test', detail: 'Example: IELTS or TOEFL with a minimum overall score.', sourceIds: [1], verified: true },
      { category: 'documents', title: 'Recognition of foreign qualifications', detail: 'Example: your diploma may need an official comparability statement.', sourceIds: [2], verified: true },
    ],
    steps: [
      { title: 'Check eligibility', detail: 'Example: compare your degree with the programme prerequisites.', sourceIds: [1], verified: true },
      { title: 'Apply online', detail: 'Example: upload transcripts, CV and test scores to the portal.', sourceIds: [1], verified: true },
    ],
    deadlines: [{ title: 'Example — application deadline', date: '31 March', sourceIds: [1], verified: true }],
    warnings: ['Example: requirements can differ for EU and non-EU applicants.'],
  },
  scholarships: {
    ...empty,
    summary: 'Sample report. Live reports list scholarships you may be eligible for, each with its official page and next deadline.',
    academicYear: '2027/28',
    officialPageUrl: 'https://example.org/scholarships',
    sources: [source(1, 'University scholarships', 'official_destination'), source(2, 'Government scholarship programme', 'official_program')],
    scholarships: [
      { name: 'Example Excellence Scholarship', provider: 'Destination university', amount: 'Example: tuition waiver', eligibility: 'Example: international master’s students with top grades', deadline: 'Example: 1 February', url: 'https://example.org/university-scholarships', sourceIds: [1], verified: true },
      { name: 'Example Government Award', provider: 'Government programme', amount: 'Example: monthly stipend', eligibility: 'Example: graduates from partner countries', deadline: 'Example: 15 October', url: 'https://example.org/government-scholarship-programme', sourceIds: [2], verified: true },
    ],
    warnings: ['Example: most scholarships require an offer of admission first.'],
  },
  visa: {
    ...empty,
    summary: 'Sample report. Live reports use only government and embassy sources to explain which visa you need and how to apply.',
    academicYear: '2027',
    officialPageUrl: 'https://example.org/student-visa',
    sources: [source(1, 'Immigration authority student visa page', 'official_government'), source(2, 'Embassy appointment page', 'official_government')],
    requirements: [
      { category: 'visa', title: 'Student visa', detail: 'Example: required for stays longer than 90 days.', sourceIds: [1], verified: true },
      { category: 'financial', title: 'Proof of funds', detail: 'Example: bank statements covering tuition and living costs.', sourceIds: [1], verified: true },
      { category: 'health', title: 'Health insurance', detail: 'Example: valid for the whole stay.', sourceIds: [1], verified: true },
    ],
    steps: [
      { title: 'Get your admission document', detail: 'Example: the university issues it after you accept the offer.', sourceIds: [1], verified: true },
      { title: 'Book an embassy appointment', detail: 'Example: book early; waiting times vary.', sourceIds: [2], verified: true },
    ],
    warnings: ['Example: confirm the current rules with the embassy before applying.'],
  },
};

// EU/EEA countries and Switzerland: citizens move between them without a student visa.
const FREE_MOVEMENT = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' '),
);

const freeMovementVisa: Omit<ResearchReport, 'checkedAt'> = {
  ...empty,
  summary:
    'Sample report. As an EU/EEA or Swiss citizen you do not need a student visa here; live reports explain the registration steps from official sources.',
  academicYear: '2027',
  officialPageUrl: 'https://example.org/free-movement',
  sources: [source(1, 'EU free movement of students', 'official_government'), source(2, 'City residence registration', 'official_government')],
  requirements: [
    { category: 'visa', title: 'No visa needed', detail: 'Example: EU/EEA citizens can study in another member state with a valid ID card or passport.', sourceIds: [1], verified: true },
    { category: 'health', title: 'Health insurance', detail: 'Example: bring your European Health Insurance Card (EHIC).', sourceIds: [1], verified: true },
  ],
  steps: [
    { title: 'Register your address', detail: 'Example: register with the local residents’ office within the first weeks.', sourceIds: [2], verified: true },
  ],
  warnings: ['Example: registration deadlines differ between cities; check the local rules.'],
};

function demoReport(request: ResearchRequest): Omit<ResearchReport, 'checkedAt'> {
  if (request.kind === 'visa' && FREE_MOVEMENT.has(request.citizenship) && FREE_MOVEMENT.has(request.destinationCountry)) {
    return freeMovementVisa;
  }
  return reports[request.kind];
}

export function createDemoResearch(request: ResearchRequest, id: string): Research {
  return {
    id,
    kind: request.kind,
    status: 'done',
    request,
    report: { ...demoReport(request), checkedAt: new Date().toISOString() },
    error: null,
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
}
