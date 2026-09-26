import { Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Input, Text } from '@/components/ui';
import { getUniversity, searchUniversities, type Scope } from '@/data/api';
import type { University } from '@/data/types';
import { flagEmoji } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';

function UniversityRow({ university, onPress }: { university: University; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={university.name}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      <Text style={styles.flag}>{flagEmoji(university.countryCode)}</Text>
      <View style={styles.rowText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {university.name}
        </Text>
        <Text variant="caption" color="textMuted">
          {university.city}, {university.country}
        </Text>
      </View>
    </Pressable>
  );
}

type PickerProps = {
  label?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  excludeId?: string | null;
  scope?: Scope;
};

/** Pick a university from the catalogue (used for destinations). */
export function UniversityPicker({ label, value, onChange, placeholder, excludeId, scope }: PickerProps) {
  const [query, setQuery] = useState('');
  const selected = getUniversity(value);
  const results = query.trim()
    ? searchUniversities(query, { scope, limit: 6 })
        .filter((u) => u.id !== excludeId)
        .slice(0, 5)
    : [];

  return (
    <View>
      {label ? (
        <Text variant="overline" color="textMuted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      {selected ? (
        <View style={[styles.selected]}>
          <Text style={styles.flag}>{flagEmoji(selected.countryCode)}</Text>
          <View style={styles.rowText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {selected.name}
            </Text>
            <Text variant="caption" color="textMuted">
              {selected.city}, {selected.country}
            </Text>
          </View>
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${selected.name}`}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <>
          <Input icon={Search} value={query} onChangeText={setQuery} placeholder={placeholder} autoCorrect={false} />
          {results.length > 0 && (
            <View style={styles.results}>
              {results.map((u) => (
                <UniversityRow
                  key={u.id}
                  university={u}
                  onPress={() => {
                    onChange(u.id);
                    setQuery('');
                  }}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

type SuggestProps = {
  label?: string;
  value: string;
  /** Called with the typed text, or with the catalogue entry the user picked. */
  onChangeText: (value: string, university?: University) => void;
  placeholder: string;
  hint?: string;
};

/** Free-text university name with catalogue suggestions. */
export function UniversityNameInput({ label, value, onChangeText, placeholder, hint }: SuggestProps) {
  const [focused, setFocused] = useState(false);
  const suggestions =
    focused && value.trim().length >= 2
      ? searchUniversities(value, { limit: 5 })
          .filter((u) => u.name !== value)
          .slice(0, 4)
      : [];

  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={(text) => onChangeText(text)}
        placeholder={placeholder}
        hint={hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        autoCorrect={false}
      />
      {suggestions.length > 0 && (
        <View style={styles.results}>
          {suggestions.map((u) => (
            <UniversityRow key={u.id} university={u} onPress={() => onChangeText(u.name, u)} />
          ))}
        </View>
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
  rowText: {
    flex: 1,
  },
  flag: {
    fontSize: 24,
  },
});
