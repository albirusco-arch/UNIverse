import type { Opportunity, OpportunityKind, OpportunitySource } from '../data/types';

/**
 * Opportunities hub: filters for the listings stored in UNIverse, and search
 * links that open the same filters on the platforms students already use.
 * LinkedIn, Handshake, JobTeaser and Eventbrite offer no public API to read
 * their listings, so the app never copies them: it links out.
 */

export type OpportunityFilter = {
  query: string;
  kinds: OpportunityKind[];
  sources: OpportunitySource[];
  location: string;
  remoteOnly: boolean;
};

export const NO_OPPORTUNITY_FILTERS: OpportunityFilter = { query: '', kinds: [], sources: [], location: '', remoteOnly: false };

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Closed: the deadline passed, or the event already started. */
export function isClosed(item: Pick<Opportunity, 'deadline' | 'startsAt'>, now: Date): boolean {
  const end = item.startsAt ?? item.deadline;
  return end !== null && new Date(end).getTime() < now.getTime();
}

/** Open listings matching the filter: verified first, then the nearest deadline or event, then the newest. */
export function filterOpportunities(items: Opportunity[], filter: OpportunityFilter, now = new Date()): Opportunity[] {
  const words = fold(filter.query).split(/\s+/).filter(Boolean);
  const place = fold(filter.location);
  const due = (item: Opportunity) => {
    const end = item.startsAt ?? item.deadline;
    return end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;
  };
  return items
    .filter((item) => !isClosed(item, now))
    .filter((item) => filter.kinds.length === 0 || filter.kinds.includes(item.kind))
    .filter((item) => filter.sources.length === 0 || filter.sources.includes(item.source))
    .filter((item) => !filter.remoteOnly || item.remote)
    .filter((item) => !place || fold(item.city).includes(place) || fold(item.countryCode) === place)
    .filter((item) => {
      if (words.length === 0) return true;
      const text = fold(`${item.title} ${item.organization} ${item.city}`);
      return words.every((word) => text.includes(word));
    })
    .sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        due(a) - due(b) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

// ---------------------------------------------------------------------------
// Search links to external platforms

export const EXTERNAL_PLATFORMS = ['linkedin', 'handshake', 'jobteaser', 'eventbrite'] as const;
export type ExternalPlatform = (typeof EXTERNAL_PLATFORMS)[number];

/** Default search terms when the student has not typed any. */
const KIND_TERMS: Record<OpportunityKind, string> = {
  internship: 'internship',
  graduate: 'graduate',
  part_time: 'part time',
  event: 'career',
};

const slug = (value: string) =>
  fold(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Search page on `platform` with the same keywords, place and (where the platform supports it) type. */
export function externalSearchUrl(platform: ExternalPlatform, filter: OpportunityFilter, language: 'en' | 'it' = 'en'): string {
  const kind = filter.kinds.length === 1 ? filter.kinds[0] : null;
  const keywords = filter.query.trim() || (kind ? KIND_TERMS[kind] : '');
  const location = filter.location.trim();

  switch (platform) {
    case 'linkedin': {
      const params = new URLSearchParams();
      if (keywords) params.set('keywords', keywords);
      if (location) params.set('location', location);
      // Experience level: 1 = internship, 2 = entry level; job type P = part-time.
      if (kind === 'internship') params.set('f_E', '1');
      if (kind === 'graduate') params.set('f_E', '2');
      if (kind === 'part_time') params.set('f_JT', 'P');
      if (filter.remoteOnly) params.set('f_WT', '2');
      return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
    }
    case 'handshake': {
      const params = new URLSearchParams();
      if (keywords) params.set('query', [keywords, location].filter(Boolean).join(' '));
      return `https://app.joinhandshake.com/stu/postings?${params.toString()}`;
    }
    case 'jobteaser': {
      const params = new URLSearchParams();
      if (keywords || location) params.set('q', [keywords, location].filter(Boolean).join(' '));
      return `https://www.jobteaser.com/${language}/job-offers?${params.toString()}`;
    }
    case 'eventbrite': {
      const where = filter.remoteOnly || !location ? 'online' : slug(location);
      return `https://www.eventbrite.com/d/${where}/${slug(filter.query) || 'career'}/`;
    }
  }
}
