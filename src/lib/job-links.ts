/**
 * Links that open the big student job platforms. LinkedIn job search takes the
 * keywords and location in the URL; Handshake and JobTeaser need the student to
 * sign in through their university first, so they open on the sign-in page.
 */
export type JobPlatformLink = { platform: 'linkedin' | 'handshake' | 'jobteaser'; url: string };

export function jobPlatformLinks(keywords: string, location: string): JobPlatformLink[] {
  const params = new URLSearchParams();
  if (keywords.trim()) params.set('keywords', keywords.trim());
  if (location.trim()) params.set('location', location.trim());
  const query = params.toString();
  return [
    { platform: 'linkedin', url: `https://www.linkedin.com/jobs/search/${query ? `?${query}` : ''}` },
    { platform: 'handshake', url: 'https://app.joinhandshake.com/' },
    { platform: 'jobteaser', url: 'https://www.jobteaser.com/' },
  ];
}

/**
 * Accepts what students paste ("linkedin.com/in/name", "www.linkedin.com/in/name/")
 * and returns the https URL the database accepts, or null if it is not a profile link.
 */
export function normalizeProfileLink(kind: 'linkedin' | 'handshake' | 'jobteaser', raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '');
  if (kind === 'linkedin') {
    const match = /^\/in\/([A-Za-z0-9%_-]+)$/.exec(path);
    if (!/^([a-z]{2,3}\.)?linkedin\.com$/.test(host) && host !== 'www.linkedin.com') return null;
    return match ? `https://www.linkedin.com/in/${match[1]}` : null;
  }
  const domain = kind === 'handshake' ? 'joinhandshake.com' : 'jobteaser.com';
  if (host !== domain && !host.endsWith(`.${domain}`)) return null;
  return `https://${host}${path}${url.search}`;
}
