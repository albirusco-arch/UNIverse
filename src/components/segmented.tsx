import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, gutter, radius } from '@/theme/tokens';

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Many options: size items to their labels and scroll horizontally. */
  scrollable?: boolean;
}) {
  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        style={[styles.item, scrollable ? styles.itemScrollable : styles.itemFill, selected && styles.itemSelected]}>
        <Text variant="caption" numberOfLines={1} style={{ color: selected ? colors.text : colors.textMuted }}>
          {option.label}
        </Text>
      </Pressable>
    );
  });
  if (!scrollable) {
    return (
      <View style={styles.container} accessibilityRole="tablist">
        {items}
      </View>
    );
  }
  // Bleeds to the screen edges so the control scrolls under them instead of being clipped.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}>
      <View style={[styles.container, styles.grow]} accessibilityRole="tablist">
        {items}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  scroll: {
    flexGrow: 0,
    marginHorizontal: -gutter,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: gutter,
  },
  grow: {
    flexGrow: 1,
  },
  item: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemFill: {
    flex: 1,
  },
  itemScrollable: {
    flexGrow: 1,
    paddingHorizontal: 14,
  },
  itemSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
  },
});
