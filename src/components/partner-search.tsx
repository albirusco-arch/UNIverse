import { router } from 'expo-router';
import { FileSearch, Plus, RefreshCw, Sparkles, UserRoundPen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PartnerCard, iscedName, languageName } from '@/components/partner-card';
import { Badge, Button, Card, Chip, ChipScroller, EmptyState, Text } from '@/components/ui';
import {
  countryName,
  getPartnerExtraction,
  getUniversity,
  listDepartments,
  listPartnerships,
  NotYourUniversityError,
  RateLimitError,
  requestPartnerExtraction,
} from '@/data/api';
import { AGREEMENT_TYPES, type AgreementType, type Region } from '@/data/types';
import { t } from '@/i18n';
import { REGION_ORDER } from '@/lib/destination-order';
import { isOlderThan } from '@/lib/format';
import { FIELD_ISCED } from '@/lib/isced';
import { filterOptions, searchPartners } from '@/lib/partner-search';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, spacing } from '@/theme/tokens';

/** After this many days the official list can be read again. */
const REFRESH_AFTER_DAYS = 30;

type Subject = 'all' | 'field' | { departmentId: string };

/**
 * Partner-first search: the agreements of the student's home university,
 * narrowed by department or subject (secondary), destination, agreement type
 * and language. Course matching (tertiary) starts from each result.
 */
export function PartnerSearch() {
  const { profile } = useSession();
  const home = getUniversity(profile.homeUniversityId);
  const homeId = home?.id ?? '';

  const { data: partnerships, refresh } = useQuery(() => (homeId ? listPartnerships(homeId) : Promise.resolve([])), [homeId]);
  const { data: departments } = useQuery(() => (homeId ? listDepartments(homeId) : Promise.resolve([])), [homeId]);
  const { data: extraction, refresh: refreshExtraction } = useQuery(
    () => (homeId ? getPartnerExtraction(homeId) : Promise.resolve(null)),
    [homeId],
  );

  const [subject, setSubject] = useState<Subject>('all');
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [country, setCountry] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<AgreementType | 'all'>('all');
  const [language, setLanguage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = extraction?.status === 'running' || extraction?.status === 'pending';
  // While the official list is being read, check for results every few seconds.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      refresh();
      refreshExtraction();
    }, 5000);
    return () => clearInterval(timer);
  }, [running, refresh, refreshExtraction]);

  if (!home) {
    return (
      <EmptyState
        icon={UserRoundPen}
        text={t('partners.noHome')}
        action={<Button title={t('partners.addHome')} variant="secondary" onPress={() => router.push('/onboarding?edit=1')} />}
      />
    );
  }

  const all = partnerships ?? [];
  const fieldCodes = profile.field ? FIELD_ISCED[profile.field] : [];
  const department = typeof subject === 'object' ? departments?.find((d) => d.id === subject.departmentId) : undefined;
  const results = searchPartners(
    all,
    {
      departmentId: department?.id ?? null,
      subjects: department ? department.iscedCodes : subject === 'field' ? fieldCodes : [],
      region,
      country,
      agreement,
      language,
    },
    getUniversity,
  );
  const options = filterOptions(all, getUniversity);
  const regions = REGION_ORDER.filter((r) => all.some((p) => getUniversity(p.partnerUniversityId)?.region === r));
  const countries = options.countries.filter(
    (code) => region === 'all' || all.some((p) => {
      const partner = getUniversity(p.partnerUniversityId);
      return partner?.countryCode === code && partner.region === region;
    }),
  );
  const official = all.filter((p) => p.source !== 'student').length;
  const sample = all.some((p) => p.sample);
  const canRead = !running && (!extraction?.checkedAt || isOlderThan(extraction.checkedAt, REFRESH_AFTER_DAYS));

  const readList = async () => {
    setError(null);
    setRequesting(true);
    try {
      await requestPartnerExtraction(home.id);
      refreshExtraction();
    } catch (err) {
      setError(
        err instanceof RateLimitError
          ? t('common.limit')
          : err instanceof NotYourUniversityError
            ? t('partners.onlyOwn')
            : t('partners.readFailed'),
      );
    } finally {
      setRequesting(false);
    }
  };

  const suggest = () => router.push('/partner/new');

  const status = running ? (
    <Card tone="primary" style={styles.status}>
      <ActivityIndicator color={colors.primaryLight} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{t('partners.readingList')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('partners.readingBody')}
        </Text>
      </View>
    </Card>
  ) : extraction?.status === 'done' ? (
    <View style={styles.note}>
      <Text variant="caption" color="textMuted">
        {t('partners.listRead', { matched: extraction.matched, found: extraction.found })}
      </Text>
      {extraction.unmatched.length > 0 && (
        <Text variant="caption" color="textMuted">
          {t('partners.unmatched', { n: extraction.unmatched.length })}
        </Text>
      )}
    </View>
  ) : extraction?.status === 'error' ? (
    <Text variant="caption" color="red">
      {t('partners.readFailed')}
    </Text>
  ) : null;

  if (partnerships && all.length === 0) {
    return (
      <View style={styles.stack}>
        <Card style={styles.empty}>
          <FileSearch size={28} color={colors.primaryLight} />
          <Text variant="title3" align="center">
            {t('partners.empty', { name: home.name })}
          </Text>
          <Text variant="callout" color="textSecondary" align="center">
            {t('partners.emptyBody')}
          </Text>
          {!running && (
            <View style={styles.buttons}>
              <Button title={t('partners.readList')} icon={Sparkles} onPress={readList} loading={requesting} />
              <Button title={t('partners.suggest')} icon={Plus} variant="secondary" onPress={suggest} />
            </View>
          )}
        </Card>
        {status}
        {error && (
          <Text variant="callout" color="red">
            {error}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View>
        <Text variant="title3">{t('partners.title', { name: home.name })}</Text>
        <Text variant="caption" color="textMuted" style={styles.summary}>
          {t('partners.count', { n: all.length })} ·{' '}
          {t('partners.summary', { official, suggested: all.length - official })}
        </Text>
      </View>
      {sample && <Badge tone="amber" icon={Sparkles} label={t('partners.demoBanner')} />}

      <View style={styles.filters}>
        <ChipScroller>
          <Chip label={t('partners.allSubjects')} selected={subject === 'all'} onPress={() => setSubject('all')} />
          {fieldCodes.length > 0 && profile.field && (
            <Chip
              label={`${t('partners.myField')} · ${t(`fields.${profile.field}`)}`}
              selected={subject === 'field'}
              onPress={() => setSubject('field')}
            />
          )}
          {(departments ?? []).map((d) => (
            <Chip
              key={d.id}
              label={d.name}
              selected={department?.id === d.id}
              onPress={() => setSubject({ departmentId: d.id })}
            />
          ))}
        </ChipScroller>
        <ChipScroller>
          <Chip tone="accent" label={t('partners.allAgreements')} selected={agreement === 'all'} onPress={() => setAgreement('all')} />
          {AGREEMENT_TYPES.filter((type) => all.some((p) => p.agreementType === type)).map((type) => (
            <Chip
              key={type}
              tone="accent"
              label={t(`partners.agreementTypes.${type}`)}
              selected={agreement === type}
              onPress={() => setAgreement(type)}
            />
          ))}
        </ChipScroller>
        <ChipScroller>
          <Chip
            label={t('regions.all')}
            selected={region === 'all'}
            onPress={() => {
              setRegion('all');
              setCountry(null);
            }}
          />
          {regions.map((r) => (
            <Chip
              key={r}
              label={t(`regions.${r}`)}
              selected={region === r}
              onPress={() => {
                setRegion(r);
                setCountry(null);
              }}
            />
          ))}
        </ChipScroller>
        {countries.length > 1 && (
          <ChipScroller>
            <Chip label={t('partners.allCountries')} selected={country === null} onPress={() => setCountry(null)} />
            {countries.map((code) => (
              <Chip
                key={code}
                label={countryName(code)}
                selected={country === code}
                onPress={() => setCountry(code)}
              />
            ))}
          </ChipScroller>
        )}
        {options.languages.length > 1 && (
          <ChipScroller>
            <Chip tone="success" label={t('partners.anyLanguage')} selected={language === null} onPress={() => setLanguage(null)} />
            {options.languages.map((code) => (
              <Chip key={code} tone="success" label={languageName(code)} selected={language === code} onPress={() => setLanguage(code)} />
            ))}
          </ChipScroller>
        )}
      </View>

      {department && department.iscedCodes.length > 0 && (
        <Text variant="caption" color="textMuted">
          {department.iscedCodes.map(iscedName).join(', ')}
        </Text>
      )}

      {results.length > 0 ? (
        <View style={styles.list}>
          {results.map((result) => (
            <PartnerCard key={result.partnership.id} result={result} />
          ))}
        </View>
      ) : (
        <EmptyState icon={FileSearch} text={t('partners.noResults')} />
      )}

      {status}
      {error && (
        <Text variant="callout" color="red">
          {error}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button title={t('partners.suggest')} icon={Plus} variant="secondary" onPress={suggest} />
        {canRead && (
          <Button title={t('partners.updateList')} icon={RefreshCw} variant="ghost" onPress={readList} loading={requesting} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  summary: {
    marginTop: 2,
  },
  filters: {
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  note: {
    gap: 2,
  },
  flex: {
    flex: 1,
  },
});
