import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { GradientText } from './gradient-text';

/** The orbit logo from the Figma prototype, drawn on a 38×38 grid. */
export function OrbitMark({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <Defs>
        <LinearGradient id="orb1" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#8B5CF6" />
          <Stop offset="100%" stopColor="#14B8A6" />
        </LinearGradient>
        <LinearGradient id="orb2" x1="38" y1="0" x2="0" y2="38" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#14B8A6" stopOpacity={0.7} />
          <Stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.7} />
        </LinearGradient>
        <RadialGradient id="planet" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#A78BFA" />
          <Stop offset="100%" stopColor="#6D28D9" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={19} cy={19} rx={17} ry={7.5} stroke="url(#orb1)" strokeWidth={1.6} transform="rotate(-35 19 19)" />
      <Ellipse cx={19} cy={19} rx={17} ry={7.5} stroke="url(#orb2)" strokeWidth={1.2} transform="rotate(35 19 19)" />
      <Circle cx={19} cy={19} r={5} fill="url(#planet)" />
      <Circle cx={17} cy={17} r={1.5} fill="white" fillOpacity={0.4} />
      <Circle cx={19} cy={3.5} r={2.2} fill="#2DD4BF" transform="rotate(-35 19 19)" />
      <Circle cx={35} cy={19} r={1.6} fill="#A78BFA" transform="rotate(35 19 19)" />
    </Svg>
  );
}

/** "UNI" + gradient "verse" wordmark next to the orbit logo. */
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="UNIverse">
      <OrbitMark size={size * 1.45} />
      <View style={styles.wordmarkText}>
        <Text style={[styles.uni, { fontSize: size, lineHeight: size * 1.15 }]}>UNI</Text>
        <GradientText
          text="verse"
          colors={['#A78BFA', '#2DD4BF']}
          style={{ fontSize: size, lineHeight: size * 1.15, fontWeight: '900', letterSpacing: -0.8 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmarkText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uni: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
});
