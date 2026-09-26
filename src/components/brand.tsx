import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { colors } from '@/theme/tokens';

import { LOCKUP, MARK, WORDMARK } from './brand-assets';

const markImage = require('@/assets/images/logo-mark.png');

/**
 * The UNIverse mark: the "U" with its orbit, cut from the uploaded logo by
 * scripts/generate-brand-assets.mjs (the same pixels as the app icon).
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={markImage}
      style={{ width: size, height: (size * MARK.height) / MARK.width }}
      contentFit="contain"
      accessibilityLabel={t('common.logo')}
    />
  );
}

/** The "UNIverse" logotype (vector outlines, identical to the splash screen). */
export function Logotype({ width, color = colors.text }: { width: number; color?: string }) {
  return (
    <Svg width={width} height={(width * WORDMARK.height) / WORDMARK.width} viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}>
      <Path d={WORDMARK.d} fill={color} />
    </Svg>
  );
}

/** Mark with the logotype underneath, in the proportions of the splash screen. `width` is the mark width. */
export function Lockup({ width }: { width: number }) {
  return (
    <View style={styles.lockup} accessible accessibilityRole="header" accessibilityLabel={t('common.appName')}>
      <LogoMark size={width} />
      <View style={{ height: width * LOCKUP.gap }} />
      <Logotype width={width * LOCKUP.wordmarkWidth} />
    </View>
  );
}

/** Mark and logotype side by side, for headers. `size` is the logotype height. */
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={t('common.appName')}>
      <LogoMark size={size * 2.6} />
      <Logotype width={(size * WORDMARK.width) / WORDMARK.height} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
