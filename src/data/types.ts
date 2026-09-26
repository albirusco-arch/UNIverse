export type Region = 'europe' | 'uk' | 'north_america' | 'asia' | 'oceania';

export const FIELDS = [
  'life_sciences',
  'biochemistry',
  'medicine',
  'computer_science',
  'engineering',
  'business',
  'law',
  'physics_math',
  'humanities',
  'social_sciences',
  'architecture',
  'other',
] as const;
export type Field = (typeof FIELDS)[number];

export const LEVELS = ['bachelor', 'master', 'phd', 'researcher'] as const;
export type Level = (typeof LEVELS)[number];

export const TOPICS = ['question', 'experience', 'housing', 'tip'] as const;
export type Topic = (typeof TOPICS)[number];

export type University = {
  id: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  region: Region;
  website: string;
  emailDomains: string[];
};

export type UniversityStats = {
  members: number;
  equivalences: number;
};

export type Profile = {
  id: string;
  displayName: string;
  homeUniversity: string;
  field: Field | null;
  level: Level | null;
  destinationId: string | null;
  term: string | null;
  verified: boolean;
};

export type Author = Pick<
  Profile,
  'id' | 'displayName' | 'homeUniversity' | 'field' | 'destinationId' | 'verified'
>;

export type Post = {
  id: string;
  author: Author;
  topic: Topic;
  body: string;
  universityId: string | null;
  field: Field | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  author: Author;
  body: string;
  createdAt: string;
};

export type Equivalence = {
  id: string;
  submittedBy: Author;
  homeUniversity: string;
  homeCourse: string;
  homeEcts: number | null;
  destinationId: string;
  destinationCourse: string;
  destinationEcts: number | null;
  approved: boolean;
  academicYear: string;
  createdAt: string;
};

export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate';

// ---------------------------------------------------------------------------
// AI course matching. The report shape mirrors the schema enforced by the
// `course-match` edge function (supabase/functions/course-match/schema.ts).

export type CourseMatchRequest = {
  homeUniversity: string;
  program: string;
  level: Level;
  destinationId: string;
  destinationName: string;
  term: string;
  courses: { name: string; ects: number | null }[];
  notes: string;
  locale: string;
};

export type RequirementCategory =
  | 'language'
  | 'academic'
  | 'credits'
  | 'application'
  | 'deadline'
  | 'documents'
  | 'financial'
  | 'other';

export type SourceKind = 'official_destination' | 'official_home' | 'official_program' | 'other';

export type MatchSource = {
  id: number;
  url: string;
  title: string;
  kind: SourceKind;
  academicYear: string;
  /** Set server-side: the agent actually opened or found this URL during research. */
  retrieved: boolean;
};

export type Verifiable = {
  sourceIds: number[];
  /** Set server-side: backed by at least one retrieved official source. */
  verified: boolean;
};

export type MatchRequirement = Verifiable & {
  category: RequirementCategory;
  title: string;
  detail: string;
};

export type MatchDeadline = Verifiable & {
  title: string;
  date: string;
};

export type CourseFit = 'strong' | 'partial' | 'weak' | 'none';

export type CoursePairing = Verifiable & {
  homeCourse: string;
  homeEcts: number | null;
  destinationCourse: string;
  destinationCode: string;
  destinationEcts: number | null;
  semester: string;
  language: string;
  url: string;
  fit: CourseFit;
  rationale: string;
};

export type MatchReport = {
  summary: string;
  academicYear: string;
  exchangePageUrl: string;
  requirements: MatchRequirement[];
  deadlines: MatchDeadline[];
  courseMatches: CoursePairing[];
  warnings: string[];
  sources: MatchSource[];
  checkedAt: string;
};

export type MatchStatus = 'pending' | 'running' | 'done' | 'error';

export type CourseMatch = {
  id: string;
  status: MatchStatus;
  request: CourseMatchRequest;
  report: MatchReport | null;
  error: string | null;
  createdAt: string;
  isDemo?: boolean;
};
