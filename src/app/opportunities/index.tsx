import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Briefcase, ChevronRight, ExternalLink, FileText, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CountryPicker } from '@/components/country-picker';
import { OpportunityCard } from '@/components/opportunity-card';
import { TokenBadge, TokenCost, useFeatureCost, useNotEnoughTokens } from '@/components/tokens';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Header, Input, Screen, SectionHeader, Text } from '@/components/ui';
import {
  countryName,
  getCv,
  InsufficientTokensError,
  listOpportunitySearches,
  listSavedOpportunities,
  NoCvError,
  requestOpportunities,
  setOpportunitySaved,
  trackSignal,
} from '@/data/api';
import { CAREER_TARGETS, type CareerTarget, type OpportunitySearch } from '@/data/types';
import { t } from '@/i18n';
import { flagEmoji, formatDate } from '@/lib/format';
import { jobPlatformLinks } from '@/lib/job-links';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { colors, radius, spacing } from '@/theme/tokens';

const MAX_COUNTRIES = 5;

function SearchRow({ search }: { search: OpportunitySearch }) {
  const found = search.report?.opportunities.length;
  const status =
    search.status === 'done'
      ? { label: String(found ?? 0), tone: 'success' as const }
      : search.status === 'error'
        ? { label: t('research.statusError'), tone: 'red' as const }
        : { label: t('research.statusPending'), tone: 'amber' as const };
  return (
    <Card
      onPress={() => router.push({ pathname: '/opportunities/[id]', params: { id: search.id } })}
      accessibilityLabel={search.request.keywords}
      style={styles.row}>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {search.request.keywords}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {search.request.types.map((type) => t(`career.targets.${type}`)).join(', ')} · {formatDate(search.createdAt)}
        </Text>
      </View>
      <Badge label={status.label} tone={status.tone} />
      <ChevronRight size={18} color={colors.textMuted} />
    </Card>
  );
}

export default function OpportunitiesScreen() {
  const { profile } = useSession();
  const { data: cv } = useQuery(getCv, []);
  const { data: searches } = useQuery(listOpportunitySearches, []);
  const { data: saved } = useQuery(listSavedOpportunities, []);
  const cost = useFeatureCost('opportunity_match');
  const notEnoughTokens = useNotEnoughTokens();

  const [types, setTypes] = useState<CareerTarget[]>(['internship']);
  const [keywords, setKeywords] = useState(profile.field ? t(`fields.${profile.field}`) : '');
  const [countries, setCountries] = useState<string[]>([]);
  const [remote, setRemote] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [languages, setLanguages] = useState('');
  const [useCv, setUseCv] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cvReady = Boolean(cv);
  const valid = types.length > 0 && keywords.trim().length >= 2;

  const toggleType = (type: CareerTarget) =>
    setTypes((list) => (list.includes(type) ? list.filter((item) => item !== type) : [...list, type]));

  const submit = async () => {
    if (!valid) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await requestOpportunities({
        types,
        keywords: keywords.trim(),
        countries,
        remote,
        startDate: startDate.trim(),
        languages: languages.trim(),
        useCv: useCv && cvReady,
        notes: notes.trim(),
      });
      trackSignal('search', keywords);
      router.push({ pathname: '/opportunities/[id]', params: { id } });
    } catch (err) {
      if (err instanceof InsufficientTokensError) notEnoughTokens('opportunity_match');
      else setError(err instanceof NoCvError ? t('cv.noCv') : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const links = jobPlatformLinks(keywords, countries[0] ? countryName(countries[0]) : '');

  return (
    <Screen header={<Header title={t('opportunities.title')} right={<TokenBadge />} />}>
      <Card style={styles.form}>
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('opportunities.types')}
          </Text>
          <ChipRow>
            {CAREER_TARGETS.map((type) => (
              <Chip key={type} label={t(`career.targets.${type}`)} selected={types.includes(type)} onPress={() => toggleType(type)} />
            ))}
          </ChipRow>
        </View>
        <Input
          label={t('opportunities.keywords')}
          value={keywords}
          onChangeText={setKeywords}
          placeholder={t('opportunities.keywordsPlaceholder')}
          icon={Search}
          maxLength={200}
        />
        <View>
          <Text variant="overline" color="textMuted" style={styles.label}>
            {t('opportunities.countries')}
          </Text>
          {countries.length > 0 && (
            <View style={styles.countries}>
              {countries.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => setCountries((list) => list.filter((item) => item !== code))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${countryName(code)}`}
                  style={styles.country}>
                  <Text variant="caption">
                    {flagEmoji(code)} {countryName(code)}
                  </Text>
                  <X size={12} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
          {countries.length < MAX_COUNTRIES && (
            <CountryPicker
              value=""
              onChange={(code) => code && setCountries((list) => (list.includes(code) ? list : [...list, code]))}
              placeholder={t('research.countryPlaceholder')}
            />
          )}
        </View>
        <ChipRow>
          <Chip label={t('opportunities.remote')} tone="accent" selected={remote} onPress={() => setRemote((value) => !value)} />
          {cvReady ? (
            <Chip
              label={t('opportunities.useCv')}
              icon={FileText}
              tone="success"
              selected={useCv}
              onPress={() => setUseCv((value) => !value)}
            />
          ) : (
            <Chip label={t('opportunities.useCvMissing')} icon={FileText} onPress={() => router.push('/cv')} />
          )}
        </ChipRow>
        <Input
          label={t('opportunities.startDate')}
          value={startDate}
          onChangeText={setStartDate}
          placeholder={t('opportunities.startDatePlaceholder')}
          maxLength={60}
        />
        <Input
          label={t('opportunities.languages')}
          value={languages}
          onChangeText={setLanguages}
          placeholder={t('opportunities.languagesPlaceholder')}
          maxLength={120}
        />
        <Input
          label={t('opportunities.notes')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('opportunities.notesPlaceholder')}
          multiline
          maxLength={500}
        />
        {error && (
          <Text variant="callout" color="red" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        <Button title={t('opportunities.submit')} icon={Briefcase} onPress={submit} loading={submitting} disabled={!valid} />
        {cost !== null && (
          <View style={styles.center}>
            <TokenCost cost={cost} />
          </View>
        )}
      </Card>

      <View style={styles.section}>
        <SectionHeader title={t('career.searchOn')} />
        <View style={styles.platforms}>
          {links.map((link) => (
            <Button
              key={link.platform}
              title={t(`career.platforms.${link.platform}`)}
              iconRight={ExternalLink}
              variant="secondary"
              size="sm"
              onPress={() => WebBrowser.openBrowserAsync(link.url).catch(() => undefined)}
              style={styles.flex}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('opportunities.saved')} />
        {saved && saved.length > 0 ? (
          <View style={styles.list}>
            {saved.map((item) => (
              <OpportunityCard
                key={item.url}
                opportunity={item.opportunity}
                saved
                compact
                onToggleSave={() => setOpportunitySaved(item.opportunity, false).catch(() => undefined)}
              />
            ))}
          </View>
        ) : (
          <Text variant="callout" color="textMuted">
            {t('opportunities.noSaved')}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('opportunities.history')} />
        {searches && searches.length > 0 ? (
          <View style={styles.list}>
            {searches.map((search) => (
              <SearchRow key={search.id} search={search} />
            ))}
          </View>
        ) : (
          <EmptyState icon={Briefcase} text={t('opportunities.noHistory')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
  label: {
    marginBottom: 8,
  },
  countries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  center: {
    alignItems: 'center',
  },
  section: {
    marginTop: spacing.xxl,
  },
  platforms: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
