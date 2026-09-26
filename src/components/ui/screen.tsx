import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { isDemoMode } from '@/lib/supabase';
import { useSvgId } from '@/lib/use-svg-id';
import { t } from '@/i18n';
import { colors, gutter, radius, spacing, tabBarClearance } from '@/theme/tokens';

import { Badge } from './primitives';
import { Text } from './text';

/** Soft blue/violet light blobs behind content, echoing the logo gradient. */
export function GlowBackground() {
  const id = useSvgId('glow');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height={1000}>
        <Defs>
          <RadialGradient id={id('blue')} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#3E58EF" stopOpacity={0.42} />
            <Stop offset="100%" stopColor="#3E58EF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id('violet')} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#A35BF5" stopOpacity={0.28} />
            <Stop offset="100%" stopColor="#A35BF5" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={id('sky')} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#80B8F8" stopOpacity={0.16} />
            <Stop offset="100%" stopColor="#80B8F8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="0%" cy={0} r={260} fill={`url(#${id('blue')})`} />
        <Circle cx="100%" cy={300} r={200} fill={`url(#${id('violet')})`} />
        <Circle cx="20%" cy={640} r={160} fill={`url(#${id('sky')})`} />
      </Svg>
    </View>
  );
}

type ScreenProps = {
  children: ReactNode;
  /** Tab screens leave room for the floating tab bar. */
  tab?: boolean;
  glow?: boolean;
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  footer?: ReactNode;
};

export function Screen({ children, tab = false, glow = true, header, contentStyle, scrollProps, footer }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {glow && <GlowBackground />}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[
            {
              paddingTop: header ? spacing.sm : insets.top + spacing.lg,
              paddingBottom: tab ? tabBarClearance + insets.bottom : insets.bottom + spacing.xxxl,
              paddingHorizontal: gutter,
            },
            contentStyle,
          ]}>
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>{footer}</View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

type HeaderProps = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  /** Modal screens show a close button instead of a back chevron. */
  modal?: boolean;
  onBack?: () => void;
};

export function Header({ title, subtitle, right, modal = false, onBack }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const Icon = modal ? X : ChevronLeft;
  return (
    <View style={[styles.header, { paddingTop: modal ? spacing.lg : insets.top + spacing.sm }]}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        accessibilityRole="button"
        accessibilityLabel={modal ? t('common.close') : t('common.back')}
        hitSlop={8}
        style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}>
        <Icon size={22} color={colors.text} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.headerTitle}>
        {title ? (
          <Text variant="title3" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  active = false,
}: {
  icon: ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.headerButton,
        active && { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
        pressed && { opacity: 0.7 },
      ]}>
      {icon}
    </Pressable>
  );
}

export function DemoBadge() {
  if (!isDemoMode) return null;
  return <Badge label={t('common.demo')} tone="amber" />;
}

/** Horizontally scrolling chip rail that bleeds to the screen edges. */
export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroller}
      contentContainerStyle={styles.chipScrollerContent}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: gutter,
    paddingBottom: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  chipScroller: {
    marginHorizontal: -gutter,
    flexGrow: 0,
  },
  chipScrollerContent: {
    paddingHorizontal: gutter,
    gap: 8,
  },
});
