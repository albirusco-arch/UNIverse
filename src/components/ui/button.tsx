import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, gradients, radius } from '@/theme/tokens';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const foreground: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: colors.text,
  ghost: colors.primaryLight,
  danger: colors.red,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const color = foreground[variant];
  const height = size === 'md' ? 52 : 40;

  const content = (
    <View style={[styles.content, { height, paddingHorizontal: size === 'md' ? 20 : 14 }]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {Icon && <Icon size={size === 'md' ? 18 : 16} color={color} strokeWidth={2.2} />}
          <Text variant={size === 'md' ? 'bodyStrong' : 'caption'} style={{ color, fontWeight: '700' }} numberOfLines={1}>
            {title}
          </Text>
          {IconRight && <IconRight size={16} color={color} strokeWidth={2.2} style={styles.iconRight} />}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}>
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: radius.md,
  },
  secondary: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  danger: {
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconRight: {
    marginLeft: 'auto',
  },
});
