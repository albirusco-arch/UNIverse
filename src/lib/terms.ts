import { t } from '@/i18n';

/** The next four exchange semesters, starting from the one after the current. */
export function upcomingTerms(now = new Date()): string[] {
  let year = now.getFullYear();
  // Spring semesters start around February, fall semesters around September.
  let spring = !(now.getMonth() >= 1 && now.getMonth() < 8);
  if (now.getMonth() >= 8) year += 1;
  const terms: string[] = [];
  for (let i = 0; i < 4; i++) {
    terms.push(spring ? t('onboarding.termSpring', { year }) : t('onboarding.termFall', { year }));
    if (!spring) year += 1;
    spring = !spring;
  }
  return terms;
}
