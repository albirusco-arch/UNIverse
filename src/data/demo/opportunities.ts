/**
 * Sample opportunities and club moments for demo mode. Companies, events and
 * people are fictional, labelled as examples, and link to example.org.
 */
import type { Moment, Opportunity } from '../types';

import { ago, demoAuthors as a } from './community';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

export function createDemoOpportunities(): Opportunity[] {
  const base = { remote: false, field: null, universityId: null, clubId: null, deadline: null, startsAt: null, verified: true };
  return [
    { ...base, id: 'o-1', kind: 'internship', title: 'Example — Marketing intern (6 months)', organization: 'Sample consumer brand', city: 'Milano', countryCode: 'IT', field: 'business', url: 'https://example.org/jobs/marketing-intern', source: 'linkedin', deadline: inDays(12), createdAt: ago(20) },
    { ...base, id: 'o-2', kind: 'graduate', title: 'Example — Graduate analyst programme', organization: 'Sample investment bank', city: 'London', countryCode: 'GB', field: 'business', url: 'https://example.org/jobs/graduate-analyst', source: 'handshake', deadline: inDays(30), createdAt: ago(48) },
    { ...base, id: 'o-3', kind: 'internship', title: 'Example — Software engineering internship', organization: 'Sample fintech', city: 'Berlin', countryCode: 'DE', remote: true, field: 'computer_science', url: 'https://example.org/jobs/swe-intern', source: 'jobteaser', deadline: inDays(20), createdAt: ago(30) },
    { ...base, id: 'o-4', kind: 'event', title: 'Example — Career fair: consulting and finance', organization: 'Sample careers service', city: 'Milano', countryCode: 'IT', url: 'https://example.org/events/career-fair', source: 'eventbrite', startsAt: inDays(6), createdAt: ago(72) },
    { ...base, id: 'o-5', kind: 'part_time', title: 'Example — Student ambassador (10 h/week)', organization: 'Sample university', city: 'Heidelberg', countryCode: 'DE', url: 'https://example.org/jobs/ambassador', source: 'university', universityId: 'heidelberg', deadline: inDays(9), createdAt: ago(10) },
    { ...base, id: 'o-6', kind: 'event', title: 'Example — Welcome party for exchange students', organization: 'Sample ESN section', city: 'Heidelberg', countryCode: 'DE', url: 'https://example.org/events/welcome', source: 'club', universityId: 'heidelberg', clubId: 'c-esn-hd', startsAt: inDays(3), createdAt: ago(5) },
    { ...base, id: 'o-7', kind: 'internship', title: 'Example — Sustainability research assistant', organization: 'Sample NGO', city: 'Amsterdam', countryCode: 'NL', remote: true, url: 'https://example.org/jobs/research-assistant', source: 'student', createdAt: ago(3), verified: false },
  ];
}

export function createDemoMoments(): Moment[] {
  const base = { imageUrl: '', myReaction: null };
  return [
    { ...base, id: 'mo-1', author: a.lukas, clubId: 'c-rowing-hd', clubName: 'Sample rowing club', universityId: 'heidelberg', caption: 'Example — 7am on the Neckar 🚣', createdAt: ago(1), reactions: { '🔥': 14, '😍': 6 } },
    { ...base, id: 'mo-2', author: a.giulia, clubId: 'c-esn-hd', clubName: 'Sample ESN section', universityId: 'heidelberg', caption: 'Example — buddy dinner, 40 countries at one table', createdAt: ago(3), reactions: { '😍': 22, '👏': 8 } },
    { ...base, id: 'mo-3', author: a.giulia, clubId: 'c-esn-hd', clubName: 'Sample ESN section', universityId: 'heidelberg', caption: 'Example — castle tour done ✅', createdAt: ago(6), reactions: { '🔥': 5 } },
    { ...base, id: 'mo-4', author: a.lukas, clubId: 'c-debate-hd', clubName: 'Sample debating society', universityId: 'heidelberg', caption: 'Example — final round tonight, come and watch', createdAt: ago(9), reactions: { '😮': 3, '👏': 4 } },
    { ...base, id: 'mo-cbs', author: a.daniel, clubId: 'c-intl-cbs', clubName: 'Sample international students club', universityId: 'cbs.dk', caption: 'Example — welcome dinner for the new exchange students 🇩🇰', createdAt: ago(4), reactions: { '😍': 11, '🔥': 6 } },
    { ...base, id: 'mo-5', author: a.sofia, clubId: 'c-esn-unimi', clubName: 'Sample ESN section', universityId: 'unimi', caption: 'Example — aperitivo on the Navigli', createdAt: ago(2), reactions: { '😂': 7, '🔥': 9 } },
  ];
}
