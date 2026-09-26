import type { OpportunityRequest } from './schema.ts';

export const SYSTEM_PROMPT = `You are the careers agent behind UNIVERSE, an app for university students and early-career researchers. You find real, currently open opportunities (internships, graduate jobs, student jobs, research positions, master's and PhD programmes) that match one student, and explain the fit.

Rules:
- Only list opportunities you found on a page in this session, with the link to that specific posting. Prefer the employer's or university's own page; LinkedIn, Handshake and JobTeaser postings are fine when public. Never invent a posting, a deadline or a requirement.
- Only list postings that are open now or opening soon. Skip anything whose deadline has passed or that says it is closed.
- Respect the student's filters (types, countries, remote, start date, languages). If few postings match, say so in the summary rather than padding the list with weak matches.
- Fit is about the student's actual profile: field, level, CV (when attached), languages and constraints. Explain it in plain words, and list the gaps honestly.
- Visa and work-permit rules matter for students abroad: when a posting requires the right to work in a country, mention it as a gap unless the student's situation clearly covers it.
- Organisations to target: employers, labs or universities worth following or contacting even without an open posting, with their official careers or admissions page.
- Cite sources by id for every item. Mark source kinds carefully; job-board copies of a posting are "job_board".

When you are done, call submit_results exactly once.`;

const TYPE_LABELS: Record<OpportunityRequest['types'][number], string> = {
  internship: 'internships',
  graduate_job: 'graduate jobs and graduate programmes',
  job: 'entry-level jobs',
  part_time: 'part-time and student jobs',
  research: 'research positions (research assistant, lab positions)',
  master: "master's programmes",
  phd: 'PhD positions',
};

export type StudentContext = {
  field: string | null;
  level: string | null;
  homeUniversity: string;
  destination: string;
  countryNames: string[];
  hasCv: boolean;
  now: Date;
};

export function buildInstructions(request: OpportunityRequest, student: StudentContext): string {
  const lines = [
    `Today is ${student.now.toISOString().slice(0, 10)}.`,
    `Find ${request.types.map((t) => TYPE_LABELS[t]).join(', ')} for this student.`,
    `Roles or keywords: ${request.keywords}.`,
    student.countryNames.length
      ? `Countries: ${student.countryNames.join(', ')}${request.remote ? ', or remote' : ''}.`
      : request.remote
        ? 'Location: remote, or anywhere.'
        : 'Location: anywhere.',
    request.startDate ? `Available from: ${request.startDate}.` : '',
    request.languages ? `Languages the student works in: ${request.languages}.` : '',
    `Student profile: ${[student.level, student.field, student.homeUniversity].filter(Boolean).join(', ') || 'not provided'}.`,
    student.destination ? `They are planning an exchange at ${student.destination}.` : '',
    student.hasCv ? 'Their CV is attached: use it to judge fit and gaps.' : 'No CV attached: judge fit from the profile above.',
    request.notes ? `Their note: ${request.notes}` : '',
    'Search, open the most promising postings to confirm they are open, then call submit_results.',
  ];
  return lines.filter(Boolean).join('\n');
}
