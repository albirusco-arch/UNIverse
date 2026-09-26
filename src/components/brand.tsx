import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSvgId } from '@/lib/use-svg-id';
import { colors } from '@/theme/tokens';

/**
 * The UNIVERSE mark: a folded-ribbon "U" with an orbit and a planet
 * (vector version of assets/brand/logo-mark.svg, without SVG filters so it
 * renders identically on iOS, Android and web).
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const id = useSvgId('lm');
  const height = (size * 440) / 600;
  const back = 'M 288 0 A 288 54 0 0 0 -288 0';
  const front = 'M -288 0 A 288 54 0 0 0 288 0';
  return (
    <Svg width={size} height={height} viewBox="320 330 600 440" fill="none" accessibilityLabel="UNIVERSE logo">
      <Defs>
        <LinearGradient id={id('left')} x1="430" y1="360" x2="640" y2="760" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4E7BF7" />
          <Stop offset="0.55" stopColor="#3E58EF" />
          <Stop offset="1" stopColor="#3140D6" />
        </LinearGradient>
        <LinearGradient id={id('right')} x1="800" y1="356" x2="700" y2="760" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#80B8F8" />
          <Stop offset="0.45" stopColor="#4F66F2" />
          <Stop offset="0.78" stopColor="#6A55F1" />
          <Stop offset="1" stopColor="#C46BF4" />
        </LinearGradient>
        <RadialGradient id={id('planet')} cx="869" cy="438" r="18" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.65" stopColor="#E9ECFF" />
          <Stop offset="1" stopColor="#AEB9FF" />
        </RadialGradient>
        <ClipPath id={id('outside')}>
          <Rect x={0} y={0} width={425} height={1000} />
          <Rect x={805} y={0} width={400} height={1000} />
        </ClipPath>
      </Defs>
      {/* Back half of the orbit, drawn only beside the U. */}
      <G clipPath={`url(#${id('outside')})`}>
        <G transform="translate(620 537) rotate(-13.5)">
          <Path d={back} stroke="#7F8CFF" strokeOpacity={0.35} strokeWidth={16} strokeLinecap="round" />
          <Path d={back} stroke="#E4E8FF" strokeWidth={5.5} strokeLinecap="round" />
        </G>
      </G>
      <Path
        d="M425 392 L538 356 L538 612 C538 660 572 694 614 694 L690 757 C665 760 640 760 614 760 C506 760 425 698 425 612 Z"
        fill={`url(#${id('left')})`}
      />
      <Path
        d="M690 390 L805 356 L805 612 C805 690 750 745 690 757 C665 735 640 710 614 694 C656 694 690 660 690 612 Z"
        fill={`url(#${id('right')})`}
      />
      {/* Front half of the orbit with a soft glow. */}
      <G transform="translate(620 537) rotate(-13.5)">
        <Path d={front} stroke="#7F8CFF" strokeOpacity={0.35} strokeWidth={16} strokeLinecap="round" />
        <Path d={front} stroke="#F4F5FF" strokeWidth={6.5} strokeLinecap="round" />
      </G>
      <Circle cx={869} cy={438} r={24} fill="#8A9CFF" fillOpacity={0.3} />
      <Circle cx={869} cy={438} r={17} fill={`url(#${id('planet')})`} />
    </Svg>
  );
}

/** Mark plus the widely tracked "UNIVERSE" logotype. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="UNIVERSE">
      <LogoMark size={size * 2.3} />
      <Text style={[styles.text, { fontSize: size, letterSpacing: size * 0.32 }]}>UNIVERSE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    color: colors.text,
    fontWeight: '600',
  },
});
