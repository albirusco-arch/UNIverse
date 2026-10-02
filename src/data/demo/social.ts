/**
 * Sample groups, messages, clubs, insights and ratings for demo mode.
 * Everything here is fictional and labelled as a sample in the UI.
 */
import type { Club, Group, GroupMessage, RatingSummary, UniversityInsights } from '../types';

import { ago, demoAuthors as a } from './community';

export type DemoGroup = Group & { memberIds: string[]; ownerId: string };

export function createDemoGroups(): DemoGroup[] {
  const base = { lastMessageAt: null, lastMessagePreview: '', myRole: null, unreadCount: 0, inviteCode: null, clubId: null, peerId: null };
  return [
    {
      ...base,
      id: 'g-heidelberg',
      name: 'Heidelberg Erasmus 2027',
      description: 'Incoming exchange students for 2027: housing, courses and meetups.',
      kind: 'group',
      visibility: 'public',
      universityId: 'heidelberg',
      memberCount: 128,
      memberIds: [a.giulia.id, a.lukas.id],
      ownerId: a.giulia.id,
      inviteCode: 'HDLB2027',
    },
    {
      ...base,
      id: 'g-biochem',
      name: 'Biochemistry abroad',
      description: 'Biochem and life-science students comparing courses and learning agreements.',
      kind: 'group',
      visibility: 'public',
      universityId: null,
      memberCount: 342,
      memberIds: [a.giulia.id, a.lukas.id, a.ines.id],
      ownerId: a.lukas.id,
      inviteCode: 'BIOCHEM1',
    },
    {
      ...base,
      id: 'g-universe',
      name: 'UNIverse announcements',
      description: 'Product news and tips. Only admins post here.',
      kind: 'channel',
      visibility: 'public',
      universityId: null,
      memberCount: 2048,
      memberIds: [a.sofia.id],
      ownerId: a.sofia.id,
      inviteCode: 'UNIVERSE',
    },
    {
      ...base,
      id: 'g-leuven',
      name: 'Leuven CS exchange',
      description: 'Computer science students heading to KU Leuven.',
      kind: 'group',
      visibility: 'public',
      universityId: 'kuleuven',
      memberCount: 57,
      memberIds: [a.sofia.id],
      ownerId: a.sofia.id,
      inviteCode: 'LEUVENCS',
    },
  ];
}

export function createDemoMessages(): GroupMessage[] {
  return [
    { id: 'm1', groupId: 'g-heidelberg', author: a.giulia, body: 'Welcome everyone! Introduce yourself: where are you coming from?', createdAt: ago(30) },
    { id: 'm2', groupId: 'g-heidelberg', author: a.lukas, body: 'Hi! Local student here, happy to help with housing questions.', createdAt: ago(20) },
    { id: 'm3', groupId: 'g-heidelberg', author: a.giulia, body: 'Tip: the international office runs an orientation week before lectures start.', createdAt: ago(3) },
    { id: 'm4', groupId: 'g-biochem', author: a.ines, body: 'Has anyone matched a lab course with fewer credits than at home?', createdAt: ago(6) },
    { id: 'm5', groupId: 'g-biochem', author: a.giulia, body: 'Yes, I combined two smaller modules to reach the same credits.', createdAt: ago(5) },
    { id: 'm6', groupId: 'g-universe', author: a.sofia, body: 'New: AI research now covers entry requirements, scholarships and visas.', createdAt: ago(10) },
    { id: 'm7', groupId: 'g-leuven', author: a.sofia, body: 'Course registration opens right after arrival, keep a plan B list!', createdAt: ago(40) },
  ];
}

export const demoReplies = [
  'Welcome! 👋',
  'Great question, I had the same doubt last year.',
  'Check the international office page, they updated it recently.',
];

export function createDemoClubs(): Club[] {
  const base = { website: '', instagram: '', groupId: null };
  return [
    { ...base, id: 'c-esn-hd', universityId: 'heidelberg', name: 'Sample ESN section', category: 'international', description: 'Example: the Erasmus Student Network section organises trips and buddy programmes.', source: 'ai', sourceUrl: 'https://example.org/esn', verified: true },
    { ...base, id: 'c-debate-hd', universityId: 'heidelberg', name: 'Sample debating society', category: 'academic', description: 'Example: weekly debates in English, open to exchange students.', source: 'community', sourceUrl: '', verified: false },
    { ...base, id: 'c-rowing-hd', universityId: 'heidelberg', name: 'Sample rowing club', category: 'sports', description: 'Example: beginner courses every semester.', source: 'ai', sourceUrl: 'https://example.org/sports', verified: true },
    { ...base, id: 'c-esn-unimi', universityId: 'unimi', name: 'Sample ESN section', category: 'international', description: 'Example: welcome events and city tours for incoming students.', source: 'ai', sourceUrl: 'https://example.org/esn-milan', verified: true },
  ];
}

export function createDemoInsights(): Record<string, UniversityInsights> {
  return {
    heidelberg: {
      universityId: 'heidelberg',
      status: 'done',
      summary:
        'Sample assessment. In the live app Claude scores sustainability and teaching only from sources it opened, and compares them with student ratings.',
      esgScore: 71,
      teachingScore: 66,
      indicators: [
        { pillar: 'environmental', label: 'Example — climate target', value: 'Example: net zero by 2040', sourceIds: [1], verified: true },
        { pillar: 'social', label: 'Example — accessibility service', value: 'Example: dedicated office', sourceIds: [2], verified: true },
        { pillar: 'governance', label: 'Example — sustainability office', value: 'Example: yes', sourceIds: [2], verified: true },
        { pillar: 'teaching', label: 'Example — student satisfaction survey', value: 'Example: 82%', sourceIds: [3], verified: true },
      ],
      sources: [
        { id: 1, url: 'https://example.org/climate-plan', title: 'Example — Climate plan', kind: 'official_destination', academicYear: '2025', retrieved: true },
        { id: 2, url: 'https://example.org/student-services', title: 'Example — Student services', kind: 'official_destination', academicYear: '', retrieved: true },
        { id: 3, url: 'https://example.org/survey', title: 'Example — National student survey', kind: 'official_program', academicYear: '2025', retrieved: true },
      ],
      checkedAt: ago(24 * 12),
      isDemo: true,
    },
    kuleuven: {
      universityId: 'kuleuven',
      status: 'done',
      summary: 'Sample assessment with strong sustainability evidence.',
      esgScore: 82,
      teachingScore: 74,
      indicators: [],
      sources: [],
      checkedAt: ago(24 * 30),
      isDemo: true,
    },
    uva: {
      universityId: 'uva',
      status: 'done',
      summary: 'Sample assessment.',
      esgScore: 77,
      teachingScore: 70,
      indicators: [],
      sources: [],
      checkedAt: ago(24 * 40),
      isDemo: true,
    },
  };
}

export function createDemoRatings(): Record<string, RatingSummary> {
  return {
    heidelberg: { count: 14, teaching: 4.3, professors: 4.1, environment: 4.5, sustainability: 3.9 },
    kuleuven: { count: 9, teaching: 4.4, professors: 4.2, environment: 4.3, sustainability: 4.4 },
    uva: { count: 6, teaching: 4.0, professors: 3.8, environment: 4.4, sustainability: 4.1 },
    unimi: { count: 2, teaching: 4.0, professors: 4.0, environment: 3.5, sustainability: 3.5 },
  };
}
