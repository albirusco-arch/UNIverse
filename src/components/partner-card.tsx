import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BadgeCheck, ChevronRight, ExternalLink, FileSearch, Handshake, MapPin, Sparkles, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Text, type BadgeTone } from '@/components/ui';
import type { Partnership } from '@/data/types';
import { strings, t } from '@/i18n';
import { flagEmoji, formatDate } from '@/lib/format';
import type { PartnerResult } from '@/lib/partner-search';
import { colors, radius, spacing } from '@/theme/tokens';

/** Name of an ISCED-F subject area, or the code itself when it has no label. */
export function iscedName(code: string): string {
  return (strings().isced as Record<string, string>)[code] ?? code;
}

/** Name of a language of instruction (ISO 639-1). */
export function languageName(code: string): string {
  return (strings().languageNames as Record<string, string>)[code] ?? code.toUpperCase();
}

/** Where an agreement comes from and whether it was checked. */
export function partnershipStatus(partnership: Pick<Partnership, 'verified' | 'source'>): {
  label: string;
  tone: BadgeTone;
  icon: typeof BadgeCheck;
} {
  if (partnership.verified) return { label: t('partners.status.verified'), tone: 'success', icon: BadgeCheck };
  if (partnership.source === 'student') return { label: t('partners.status.student'), tone: 'neutral', icon: UserRound };
  return { label: t('partners.status.official'), tone: 'amber', icon: FileSearch };
}

export function PartnerCard({ result }: { result: PartnerResult }) {
  const { partnership, university, fit } = result;
  const status = partnershipStatus(partnership);
  const subjects = partnership.iscedCodes.length
    ? partnership.iscedCodes.map(iscedName).join(', ')
    : t('partners.allSubjectsAgreement');
  const languages = partnership.languages.length
    ? [
        t('partners.taughtIn', { languages: partnership.languages.map(languageName).join(', ') }),
        partnership.languageLevel ? t('partners.languageLevel', { level: partnership.languageLevel }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  const details = [
    partnership.homeDepartment?.name ?? t('partners.wholeUniversity'),
    partnership.places ? t('partners.places', { n: partnership.places }) : null,
    partnership.academicYear || null,
  ].filter(Boolean);

  const matchCourses = () =>
    router.navigate({ pathname: '/research', params: { kind: 'exchange', destinationId: university.id } });

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: '/university/[id]', params: { id: university.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${university.name}, ${t(`partners.agreementTypes.${partnership.agreementType}`)}, ${status.label}`}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.85 }]}>
        <Text style={styles.flag}>{flagEmoji(university.countryCode)}</Text>
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {university.name}
          </Text>
          <View style={styles.location}>
            <MapPin size={12} color={colors.textMuted} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
              {university.city ? `${university.city}, ` : ''}
              {university.country}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.badges}>
        <Badge tone="primary" label={t(`partners.agreementTypes.${partnership.agreementType}`)} />
        <Badge tone={status.tone} icon={status.icon} label={status.label} />
        {fit !== 'open' && <Badge tone="accent" label={t(`partners.fit.${fit}`)} />}
        {partnership.sample && <Badge tone="amber" icon={Sparkles} label={t('partners.status.sample')} />}
      </View>

      <View style={styles.details}>
        <Text variant="caption" color="textSecondary">
          {details.join(' · ')}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {subjects}
        </Text>
        {languages && (
          <Text variant="caption" color="textMuted">
            {languages}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(partnership.sourceUrl)}
          accessibilityRole="link"
          style={styles.source}>
          <ExternalLink size={13} color={colors.primaryLight} />
          <View style={styles.flex}>
            <Text variant="caption" color="primaryLight">
              {t('partners.officialList')}
            </Text>
            {partnership.lastVerified && (
              <Text variant="caption" color="textMuted" style={styles.small}>
                {t('partners.checked', { date: formatDate(partnership.lastVerified) })}
              </Text>
            )}
          </View>
        </Pressable>
        <Button title={t('partners.matchCourses')} icon={Sparkles} variant="secondary" size="sm" onPress={matchCourses} />
      </View>
    </View>
  );
}

/** On a university page: the agreements the student's home university has with it. */
export function PartnerOfCard({ agreements, homeName }: { agreements: Partnership[]; homeName: string }) {
  return (
    <Card tone="success" style={styles.partnerOf}>
      <View style={styles.partnerOfTitle}>
        <Handshake size={18} color={colors.successLight} />
        <Text variant="title3" style={styles.flex}>
          {t('partners.partnerOf', { name: homeName })}
        </Text>
      </View>
      {agreements.map((agreement) => {
        const status = partnershipStatus(agreement);
        return (
          <View key={agreement.id} style={styles.agreement}>
            <View style={styles.badges}>
              <Badge tone="primary" label={t(`partners.agreementTypes.${agreement.agreementType}`)} />
              <Badge tone={status.tone} icon={status.icon} label={status.label} />
              {agreement.sample && <Badge tone="amber" icon={Sparkles} label={t('partners.status.sample')} />}
            </View>
            <Text variant="caption" color="textSecondary">
              {[
                agreement.homeDepartment?.name ?? t('partners.wholeUniversity'),
                agreement.iscedCodes.length ? agreement.iscedCodes.map(iscedName).join(', ') : null,
                agreement.places ? t('partners.places', { n: agreement.places }) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text
              variant="caption"
              color="primaryLight"
              onPress={() => WebBrowser.openBrowserAsync(agreement.sourceUrl)}
              accessibilityRole="link">
              {t('partners.officialList')}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  partnerOf: {
    gap: spacing.md,
  },
  partnerOfTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  agreement: {
    gap: spacing.xs,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flag: {
    fontSize: 30,
  },
  flex: {
    flex: 1,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  details: {
    gap: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  source: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  small: {
    fontSize: 11,
  },
});
