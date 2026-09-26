export const REGIONS = [
  'europe',
  'uk',
  'north_america',
  'latin_america',
  'asia',
  'middle_east',
  'africa',
  'oceania',
] as const;
export type Region = (typeof REGIONS)[number];

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
  /** City or state; empty when the source dataset does not provide it. */
  city: string;
  country: string;
  countryCode: string;
  region: Region;
  website: string;
  emailDomains: string[];
  /** Official Erasmus institutional code, when imported from the EWP registry. */
  erasmusCode: string | null;
  /** In an Erasmus+ programme country (otherwise "overseas"). */
  erasmus: boolean;
  /** Hand-checked entry, shown first. */
  featured: boolean;
};

export type UniversityStats = {
  members: number;
  equivalences: number;
};

export type Profile = {
  id: string;
  displayName: string;
  homeUniversity: string;
  homeUniversityId: string | null;
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

export type ReportTarget = 'post' | 'comment' | 'message' | 'user' | 'group' | 'club';
export type ReportReason = 'spam' | 'harassment' | 'misinformation' | 'inappropriate';

// ---------------------------------------------------------------------------
// AI research. The report shape mirrors the schema enforced by the `research`
// edge function (supabase/functions/research/schema.ts).

export const RESEARCH_KINDS = ['exchange', 'admission', 'scholarships', 'visa'] as const;
export type ResearchKind = (typeof RESEARCH_KINDS)[number];
export type StudyType = 'exchange' | 'degree';

export type ResearchRequest = {
  kind: ResearchKind;
  homeUniversity: string;
  program: string;
  level: Level;
  field: Field | null;
  destinationId: string | null;
  destinationName: string;
  /** ISO 3166-1 alpha-2. */
  destinationCountry: string;
  /** ISO 3166-1 alpha-2 of the student's citizenship. */
  citizenship: string;
  /** Current qualification, e.g. "BSc Biology, 105/110". */
  qualification: string;
  studyType: StudyType;
  term: string;
  durationMonths: number | null;
  courses: { name: string; ects: number | null }[];
  notes: string;
};

export type RequirementCategory =
  | 'language'
  | 'academic'
  | 'credits'
  | 'application'
  | 'deadline'
  | 'documents'
  | 'financial'
  | 'visa'
  | 'health'
  | 'other';

export type SourceKind = 'official_destination' | 'official_home' | 'official_program' | 'official_government' | 'other';

export type Source = {
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

export type Requirement = Verifiable & { category: RequirementCategory; title: string; detail: string };
export type Deadline = Verifiable & { title: string; date: string };
export type Step = Verifiable & { title: string; detail: string };

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

export type Scholarship = Verifiable & {
  name: string;
  provider: string;
  amount: string;
  eligibility: string;
  deadline: string;
  url: string;
};

export type ResearchReport = {
  summary: string;
  academicYear: string;
  officialPageUrl: string;
  requirements: Requirement[];
  deadlines: Deadline[];
  steps: Step[];
  courseMatches: CoursePairing[];
  scholarships: Scholarship[];
  warnings: string[];
  sources: Source[];
  checkedAt: string;
};

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export type Research = {
  id: string;
  kind: ResearchKind;
  status: JobStatus;
  request: ResearchRequest;
  report: ResearchReport | null;
  error: string | null;
  createdAt: string;
  isDemo?: boolean;
};

// ---------------------------------------------------------------------------
// University quality: ESG and teaching indicators researched by the
// `university-insights` edge function, plus ratings from verified students.

export type InsightPillarName = 'environmental' | 'social' | 'governance' | 'teaching';

export type Indicator = Verifiable & {
  pillar: InsightPillarName;
  label: string;
  value: string;
};

export type UniversityInsights = {
  universityId: string;
  status: JobStatus;
  summary: string;
  /** 0–100, null when the sources are not enough to score. */
  esgScore: number | null;
  teachingScore: number | null;
  indicators: Indicator[];
  sources: Source[];
  checkedAt: string | null;
  isDemo?: boolean;
};

export const RATING_DIMENSIONS = ['teaching', 'professors', 'environment', 'sustainability'] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export type StudentRelation = 'exchange' | 'degree' | 'researcher';

export type UniversityRating = Record<RatingDimension, number> & {
  relation: StudentRelation;
  academicYear: string;
};

export type RatingSummary = Record<RatingDimension, number | null> & { count: number };

export type UniversityScore = {
  universityId: string;
  /** Combined UNIVERSE score, 0–100. */
  score: number | null;
  esgScore: number | null;
  teachingScore: number | null;
  /** Average student rating scaled to 0–100. */
  studentScore: number | null;
  ratingCount: number;
  /** Fewer than MIN_RATINGS student ratings: the score relies on public sources only. */
  provisional: boolean;
};

// ---------------------------------------------------------------------------
// Student clubs

export const CLUB_CATEGORIES = [
  'international',
  'academic',
  'culture',
  'sports',
  'tech',
  'volunteering',
  'arts',
  'other',
] as const;
export type ClubCategory = (typeof CLUB_CATEGORIES)[number];

export type Club = {
  id: string;
  universityId: string;
  name: string;
  category: ClubCategory;
  description: string;
  website: string;
  instagram: string;
  /** "ai": found by the insights research (with a source); "community": suggested by a student. */
  source: 'ai' | 'community';
  sourceUrl: string;
  verified: boolean;
  groupId: string | null;
};

// ---------------------------------------------------------------------------
// Groups: WhatsApp-style chats and Telegram-style public groups and channels

export type GroupKind = 'group' | 'channel';
export type GroupVisibility = 'public' | 'private';
export type GroupRole = 'owner' | 'admin' | 'member';

export type Group = {
  id: string;
  name: string;
  description: string;
  kind: GroupKind;
  visibility: GroupVisibility;
  universityId: string | null;
  clubId: string | null;
  memberCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  myRole: GroupRole | null;
  unreadCount: number;
  /** Only visible to members. */
  inviteCode: string | null;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  author: Author;
  body: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Personalisation signals (what the student searches, views and researches)

export type SignalKind = 'search' | 'view_university' | 'research' | 'save_university' | 'course';

export type Signal = {
  kind: SignalKind;
  value: string;
  createdAt: string;
};
