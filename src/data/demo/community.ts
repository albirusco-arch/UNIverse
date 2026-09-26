/**
 * Sample community content for demo mode. People, posts and equivalences are
 * fictional and only shown when no backend is configured.
 */
import type { Author, Comment, Equivalence, Post } from '../types';

const HOUR = 60 * 60 * 1000;
export const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

export const demoAuthors: Record<string, Author> = {
  giulia: { id: 'demo-giulia', displayName: 'Giulia R.', homeUniversity: 'University of Milan', field: 'biochemistry', destinationId: 'heidelberg', verified: true },
  lukas: { id: 'demo-lukas', displayName: 'Lukas M.', homeUniversity: 'Heidelberg University', field: 'life_sciences', destinationId: 'unimi', verified: true },
  sofia: { id: 'demo-sofia', displayName: 'Sofia P.', homeUniversity: 'University of Bologna', field: 'computer_science', destinationId: 'kuleuven', verified: true },
  marco: { id: 'demo-marco', displayName: 'Marco T.', homeUniversity: 'University of Padua', field: 'engineering', destinationId: 'tum', verified: true },
  ines: { id: 'demo-ines', displayName: 'Inès D.', homeUniversity: 'Sorbonne University', field: 'medicine', destinationId: 'ub', verified: true },
  aiko: { id: 'demo-aiko', displayName: 'Aiko S.', homeUniversity: 'The University of Tokyo', field: 'physics_math', destinationId: 'uva', verified: true },
  daniel: { id: 'demo-daniel', displayName: 'Daniel K.', homeUniversity: 'University of Toronto', field: 'business', destinationId: 'copenhagen', verified: true },
};

const a = demoAuthors;

export function createDemoPosts(): Post[] {
  const base = { likedByMe: false, savedByMe: false };
  return [
    {
      ...base,
      id: 'p1',
      author: a.giulia,
      topic: 'experience',
      universityId: 'heidelberg',
      field: 'biochemistry',
      body: 'Biochemistry from Milan to Heidelberg: my learning agreement finally got approved! Tip: bring the full course descriptions of every exam you want to swap. My coordinator compared hours and syllabus topics, not just the course titles. Happy to answer questions.',
      createdAt: ago(2),
      likeCount: 48,
      commentCount: 2,
    },
    {
      ...base,
      id: 'p2',
      author: a.marco,
      topic: 'question',
      universityId: 'tum',
      field: 'engineering',
      body: 'Anyone from an Italian engineering bachelor who did Erasmus at TUM? I am trying to understand whether exchange students can take master-level modules and how that was handled in your learning agreement.',
      createdAt: ago(5),
      likeCount: 12,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p3',
      author: a.lukas,
      topic: 'housing',
      universityId: 'unimi',
      field: 'life_sciences',
      body: 'Coming to Milan for my exchange in spring. Where did you find housing, and how early did you start looking?',
      createdAt: ago(9),
      likeCount: 21,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p4',
      author: a.sofia,
      topic: 'tip',
      universityId: 'kuleuven',
      field: 'computer_science',
      body: 'Leuven tip: keep a plan B list of courses before you arrive. Timetables can clash and some courses fill up, and having alternatives already checked with your coordinator saves a lot of stress.',
      createdAt: ago(20),
      likeCount: 35,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p5',
      author: a.ines,
      topic: 'question',
      universityId: 'ub',
      field: 'medicine',
      body: 'Medicine students: did your clinical placements abroad count toward your home degree? Looking for experiences from anyone who went to Barcelona.',
      createdAt: ago(27),
      likeCount: 9,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p6',
      author: a.aiko,
      topic: 'experience',
      universityId: 'uva',
      field: 'physics_math',
      body: 'Semester in Amsterdam done! Biggest lesson: the academic year is split into shorter periods, so check how they line up with your home semester before you pick courses.',
      createdAt: ago(49),
      likeCount: 27,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p7',
      author: a.daniel,
      topic: 'question',
      universityId: 'copenhagen',
      field: 'business',
      body: 'Is it worth learning some Danish before an exchange in Copenhagen, or did English get you through daily life?',
      createdAt: ago(73),
      likeCount: 14,
      commentCount: 0,
    },
    {
      ...base,
      id: 'p8',
      author: a.giulia,
      topic: 'housing',
      universityId: 'heidelberg',
      field: 'biochemistry',
      body: 'Heidelberg housing: start early and join the groups for international students. Rooms go quickly before the winter semester starts.',
      createdAt: ago(96),
      likeCount: 31,
      commentCount: 0,
    },
  ];
}

export function createDemoComments(): Comment[] {
  return [
    { id: 'c1', postId: 'p1', author: a.sofia, body: 'Congrats! Did they accept a course with fewer credits than yours?', createdAt: ago(1.5) },
    { id: 'c2', postId: 'p1', author: a.giulia, body: 'Yes, but I had to combine two smaller modules to reach the same number of credits.', createdAt: ago(1) },
  ];
}

export function createDemoEquivalences(): Equivalence[] {
  return [
    { id: 'e1', submittedBy: a.giulia, homeUniversity: 'University of Milan', homeCourse: 'Biochemistry II', homeEcts: 6, destinationId: 'heidelberg', destinationCourse: 'Molecular Biochemistry', destinationEcts: 6, approved: true, academicYear: '2025/26', createdAt: ago(30) },
    { id: 'e2', submittedBy: a.giulia, homeUniversity: 'University of Milan', homeCourse: 'Cell Biology', homeEcts: 6, destinationId: 'heidelberg', destinationCourse: 'Cell Biology', destinationEcts: 8, approved: true, academicYear: '2025/26', createdAt: ago(30) },
    { id: 'e3', submittedBy: a.sofia, homeUniversity: 'University of Bologna', homeCourse: 'Algorithms and Data Structures', homeEcts: 9, destinationId: 'kuleuven', destinationCourse: 'Data Structures and Algorithms', destinationEcts: 6, approved: false, academicYear: '2024/25', createdAt: ago(200) },
    { id: 'e4', submittedBy: a.marco, homeUniversity: 'University of Padua', homeCourse: 'Fluid Mechanics', homeEcts: 9, destinationId: 'tum', destinationCourse: 'Fluid Mechanics', destinationEcts: 6, approved: true, academicYear: '2025/26', createdAt: ago(120) },
    { id: 'e5', submittedBy: a.giulia, homeUniversity: 'University of Milan', homeCourse: 'Genetics', homeEcts: 8, destinationId: 'heidelberg', destinationCourse: 'Molecular Genetics', destinationEcts: 6, approved: true, academicYear: '2024/25', createdAt: ago(400) },
  ];
}
