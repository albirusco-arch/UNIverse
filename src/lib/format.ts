import { t } from '@/i18n';

export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('common.minutesAgo', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('common.hoursAgo', { n: hours });
  return t('common.daysAgo', { n: Math.round(hours / 24) });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Regional-indicator emoji for an ISO 3166-1 alpha-2 country code. */
export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** True when the ISO date is more than `days` days in the past. */
export function isOlderThan(iso: string, days: number): boolean {
  return Date.now() - Date.parse(iso) > days * 24 * 3_600_000;
}
