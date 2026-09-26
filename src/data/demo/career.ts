/**
 * Illustrative CV reviews and opportunity matches for demo mode. They are
 * labelled as samples in the UI; postings link only to example.org.
 */
import type {
  CvReport,
  CvReview,
  CvReviewRequest,
  OpportunityReport,
  OpportunityRequest,
  OpportunitySearch,
} from '../types';

export function createDemoCvReview(request: CvReviewRequest, id: string): CvReview {
  const report: CvReport = {
    overallScore: 68,
    summary: `Sample review. For a ${request.targetRole} application the CV has a clear education section, but experience bullets list duties instead of results and key tools are missing from the skills section.`,
    headline: 'Biotechnology student with Python and lab data-analysis experience',
    strengths: ['Clear, one-page layout', 'Relevant coursework listed', 'Exchange experience shows adaptability'],
    improvements: [
      {
        priority: 'high',
        section: 'Experience',
        issue: 'Bullets describe tasks, not outcomes.',
        suggestion: 'Start each bullet with a verb and say what changed thanks to your work.',
        example: 'Automated plate-reader analysis in Python, cutting weekly processing time for the lab.',
      },
      {
        priority: 'medium',
        section: 'Skills',
        issue: 'Tools are mixed with soft skills.',
        suggestion: 'Group technical skills (Python, R, SQL) separately and list languages with CEFR levels.',
        example: '',
      },
      {
        priority: 'low',
        section: 'Layout',
        issue: 'Dates use two different formats.',
        suggestion: 'Use one format, e.g. "Sep 2025 – Feb 2026".',
        example: '',
      },
    ],
    atsChecks: [
      { check: 'Standard section headings', status: 'pass', detail: 'Education, Experience and Skills are easy to find.' },
      { check: 'Readable text', status: 'pass', detail: 'The PDF contains real text, not an image.' },
      { check: 'Contact details', status: 'warning', detail: 'Add a LinkedIn URL next to your email.' },
    ],
    keywords: { present: ['Python', 'Laboratory techniques'], missing: ['SQL', 'Data visualisation'] },
    sectionScores: [
      { section: 'Education', score: 82, comment: 'Clear and complete.' },
      { section: 'Experience', score: 55, comment: 'Needs outcomes and numbers you know.' },
      { section: 'Skills', score: 64, comment: 'Separate tools from soft skills.' },
    ],
    nextSteps: ['Rewrite the two lab bullets with outcomes.', 'Add a skills line for tools.', 'Add your LinkedIn URL.'],
    checkedAt: new Date().toISOString(),
  };
  return { id, status: 'done', request, report, error: null, createdAt: new Date().toISOString(), isDemo: true };
}

export function createDemoOpportunities(request: OpportunityRequest, id: string): OpportunitySearch {
  const report: OpportunityReport = {
    summary: `Sample results. In the live app Claude searches employer sites, LinkedIn, Handshake and JobTeaser for open ${request.keywords} positions and opens each posting to confirm it.`,
    opportunities: [
      {
        title: 'Example — Bioinformatics Intern',
        organization: 'Example Biotech',
        type: 'internship',
        location: 'Heidelberg, Germany',
        remote: false,
        deadline: 'Example: 31 January',
        startDate: 'Example: March',
        url: 'https://example.org/careers/bioinformatics-intern',
        platform: 'company',
        fit: 84,
        reasons: ['Your Python and lab-data experience matches the role'],
        requirements: ['Enrolled student', 'Python', 'English'],
        gaps: ['Some SQL experience is preferred'],
        sourceIds: [1],
        verified: true,
      },
      {
        title: 'Example — Data Analyst Graduate Programme',
        organization: 'Example Pharma',
        type: 'graduate_job',
        location: 'Amsterdam, Netherlands',
        remote: false,
        deadline: 'Example: rolling',
        startDate: 'Example: September',
        url: 'https://example.org/jobs/data-analyst-graduate',
        platform: 'job_board',
        fit: 71,
        reasons: ['Field and level match'],
        requirements: ["Bachelor's degree by start date", 'Data visualisation'],
        gaps: ['Right to work in the Netherlands (EU citizens have it)'],
        sourceIds: [2],
        verified: true,
      },
      {
        title: 'Example — Research Assistant, Protein Lab',
        organization: 'Example University',
        type: 'research',
        location: 'Remote-friendly',
        remote: true,
        deadline: 'Not stated',
        startDate: '',
        url: 'https://example.org/lab/research-assistant',
        platform: 'university',
        fit: 62,
        reasons: ['Matches your biochemistry coursework'],
        requirements: ['Wet-lab experience'],
        gaps: [],
        sourceIds: [3],
        verified: false,
      },
    ],
    organizations: [
      {
        name: 'Example Life Sciences Lab',
        why: 'Runs a summer internship for bachelor students every year.',
        careersUrl: 'https://example.org/lab/careers',
        sourceIds: [3],
        verified: false,
      },
    ],
    tips: ['Apply 4–6 months before your start date.', 'Message alumni on LinkedIn before applying.'],
    sources: [
      { id: 1, url: 'https://example.org/careers/bioinformatics-intern', title: 'Example posting', kind: 'employer', retrieved: true },
      { id: 2, url: 'https://example.org/jobs/data-analyst-graduate', title: 'Example job board', kind: 'job_board', retrieved: true },
      { id: 3, url: 'https://example.org/lab/research-assistant', title: 'Example lab page', kind: 'university', retrieved: false },
    ],
    checkedAt: new Date().toISOString(),
  };
  return { id, status: 'done', request, report, error: null, createdAt: new Date().toISOString(), isDemo: true };
}
