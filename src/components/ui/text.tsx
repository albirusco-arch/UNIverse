import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, type as typeScale, type ColorName, type TypeVariant } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[typeScale[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
