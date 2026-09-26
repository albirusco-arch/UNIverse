import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, type TextStyle } from 'react-native';

import { gradients } from '@/theme/tokens';

export type GradientTextProps = {
  text: string;
  style: TextStyle;
  colors?: readonly [string, string, ...string[]];
};

/** Text filled with a horizontal gradient (native: masked view; web: see .web.tsx). */
export function GradientText({ text, style, colors = gradients.brandText }: GradientTextProps) {
  return (
    <MaskedView
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
      style={{ alignSelf: 'flex-start' }}
      maskElement={<Text style={style}>{text}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Text style={[style, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
