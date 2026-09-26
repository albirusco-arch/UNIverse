import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Input, Text } from '@/components/ui';
import { countryList, countryName, normalize } from '@/data/api';
import { t } from '@/i18n';
import { flagEmoji } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

type Props = {
  label?: string;
  /** ISO 3166-1 alpha-2, or '' for none. */
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
};

/** Search-and-pick a country from the catalogue's country list. */
export function CountryPicker({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const q = normalize(query);
  const results = q
    ? countryList
        .filter((c) => normalize(c.name).includes(q) || c.code.toLowerCase() === q)
        .sort((a, b) => Number(!normalize(a.name).startsWith(q)) - Number(!normalize(b.name).startsWith(q)))
        .slice(0, 5)
    : [];

  return (
    <View>
      {label ? (
        <Text variant="overline" color="textMuted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      {value ? (
        <View style={styles.selected}>
          <Text style={styles.flag}>{flagEmoji(value)}</Text>
          <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
            {countryName(value)}
          </Text>
          <Pressable
            onPress={() => onChange('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.remove', { name: countryName(value) })}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <>
          <Input icon={Search} value={query} onChangeText={setQuery} placeholder={placeholder} autoCorrect={false} />
          {results.length > 0 && (
            <View style={styles.results}>
              {results.map((country) => (
                <Pressable
                  key={country.code}
                  onPress={() => {
                    onChange(country.code);
                    setQuery('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={country.name}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
                  <Text style={styles.flag}>{flagEmoji(country.code)}</Text>
                  <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {country.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
  },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  results: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  flex: {
    flex: 1,
  },
  flag: {
    fontSize: 22,
  },
});
