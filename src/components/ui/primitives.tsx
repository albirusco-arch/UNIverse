import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { initials } from '@/lib/format';
import { colors, gradients, radius, spacing } from '@/theme/tokens';

import { Text } from './text';

// ---------------------------------------------------------------------------
// Card

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: 'default' | 'primary' | 'accent' | 'success' | 'amber';
};

const cardTones = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  primary: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  accent: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  success: { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
  amber: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
};

export function Card({ children, style, onPress, accessibilityLabel, tone = 'default' }: CardProps) {
  const cardStyle = [styles.card, cardTones[tone], style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [cardStyle, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Chip (selectable pill)

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'primary' | 'accent' | 'success';
  icon?: LucideIcon;
};

const chipColors = { primary: colors.primary, accent: colors.accent, success: colors.success };

export function Chip({ label, selected = false, onPress, tone = 'primary', icon: Icon }: ChipProps) {
  const activeColor = chipColors[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: activeColor, borderColor: activeColor } : null,
        pressed && { opacity: 0.8 },
      ]}>
      {Icon && <Icon size={14} color={selected ? '#FFFFFF' : colors.textMuted} strokeWidth={2.2} />}
      <Text variant="caption" style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Badge (static label)

const badgeTones = {
  primary: { bg: colors.primarySoft, border: colors.primaryBorder, fg: colors.primaryPale },
  accent: { bg: colors.accentSoft, border: colors.accentBorder, fg: colors.accentLight },
  success: { bg: colors.successSoft, border: colors.successBorder, fg: colors.successLight },
  amber: { bg: colors.amberSoft, border: colors.amberBorder, fg: colors.amber },
  red: { bg: colors.redSoft, border: colors.redBorder, fg: colors.red },
  neutral: { bg: colors.surfaceStrong, border: colors.border, fg: colors.textSecondary },
};

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ label, tone = 'neutral', icon: Icon }: { label: string; tone?: BadgeTone; icon?: LucideIcon }) {
  const palette = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {Icon && <Icon size={12} color={palette.fg} strokeWidth={2.4} />}
      <Text variant="caption" style={{ color: palette.fg, fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inputs

type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  icon?: LucideIcon;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({ label, hint, icon: Icon, containerStyle, style, multiline, ...rest }: InputProps) {
  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="overline" color="textMuted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.inputBox, multiline && styles.inputBoxMultiline]}>
        {Icon && <Icon size={16} color={colors.textMuted} strokeWidth={2} />}
        <TextInput
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primaryLight}
          accessibilityLabel={label ?? rest.placeholder}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
      </View>
      {hint ? (
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section header

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text variant="title3" accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={styles.sectionAction}>
          <Text variant="caption" color="primaryLight">
            {action}
          </Text>
          <ChevronRight size={14} color={colors.primaryLight} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar (initials on brand gradient)

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Icon tile (Quick access, feature lists)

export function IconTile({
  icon: Icon,
  colors: tileColors,
  size = 56,
}: {
  icon: LucideIcon;
  colors: readonly [string, string, ...string[]];
  size?: number;
}) {
  return (
    <LinearGradient
      colors={tileColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.42} color="#FFFFFF" strokeWidth={1.9} />
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Settings-style row

export function ListRow({
  icon: Icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  icon?: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? colors.red : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      {Icon && <Icon size={18} color={destructive ? colors.red : colors.textSecondary} strokeWidth={2} />}
      <Text variant="bodyStrong" style={{ color, flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="callout" color="textMuted" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {onPress && !destructive ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ---------------------------------------------------------------------------
// Empty state

export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon size={22} color={colors.primaryLight} strokeWidth={2} />
      </View>
      <Text variant="callout" color="textSecondary" align="center">
        {text}
      </Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Horizontal chip rail

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputBoxMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 110,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  hint: {
    marginTop: 6,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  rowValue: {
    maxWidth: '45%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    marginLeft: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
