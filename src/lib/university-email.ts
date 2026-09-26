/**
 * Decides whether an email belongs to a university, and which one.
 * Pure module (no app imports) so it can be unit-tested with node --test.
 * The same rules are enforced server-side by public.is_university_email().
 */

type UniversityLike = { id: string; emailDomains: string[] };

/** Academic top-level patterns: .edu, .edu.xx and .ac.xx (e.g. ac.uk, ac.jp, edu.au). */
const ACADEMIC_DOMAIN = /(^|\.)(edu|edu\.[a-z]{2}|ac\.[a-z]{2})$/;

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function createEmailMatcher<T extends UniversityLike>(universities: T[]) {
  const byDomain = new Map<string, T>();
  for (const university of universities) {
    for (const domain of university.emailDomains) {
      if (!byDomain.has(domain)) byDomain.set(domain, university);
    }
  }

  /** The university whose domain (or a parent of it) matches the email, e.g. studenti.unimi.it → unimi.it. */
  function match(email: string): T | null {
    const labels = emailDomain(email).split('.');
    for (let i = 0; i < labels.length - 1; i++) {
      const candidate = labels.slice(i).join('.');
      const university = byDomain.get(candidate);
      if (university) return university;
    }
    return null;
  }

  function isAllowed(email: string): boolean {
    const domain = emailDomain(email);
    if (!/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email.trim())) return false;
    return match(email) !== null || ACADEMIC_DOMAIN.test(domain);
  }

  return { match, isAllowed };
}
