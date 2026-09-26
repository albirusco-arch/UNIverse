import { universities } from '@/data/catalogue';
import { REVIEW_EMAIL } from '@/lib/config';

import { createEmailMatcher } from './university-email';

const matcher = createEmailMatcher(universities);

/** The university an email address belongs to, if it is in the catalogue. */
export const universityForEmail = matcher.match;

/**
 * Sign-in is limited to university email addresses (checked again by the
 * database). The App Store review account is the only exception.
 */
export function isStudentEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (REVIEW_EMAIL !== null && normalized === REVIEW_EMAIL) || matcher.isAllowed(normalized);
}
