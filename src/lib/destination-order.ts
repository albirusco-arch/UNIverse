import type { Region } from '../data/types';

/**
 * UNIverse is a European app: destinations are listed Europe first (including
 * the UK, Ireland and Switzerland), then Canada, then Australia, then every
 * other country, with the United States last.
 */
export function destinationRank(university: { region: Region; countryCode: string }): number {
  if (university.region === 'europe' || university.region === 'uk') return 0;
  if (university.countryCode === 'CA') return 1;
  if (university.countryCode === 'AU') return 2;
  if (university.countryCode === 'US') return 4;
  return 3;
}

/** Region filters in the same order: Europe, then North America (Canada before the US), Oceania, then the rest. */
export const REGION_ORDER: Region[] = ['europe', 'uk', 'north_america', 'oceania', 'asia', 'latin_america', 'middle_east', 'africa'];
