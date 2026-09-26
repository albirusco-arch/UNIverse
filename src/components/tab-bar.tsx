import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Compass, House, Sparkles, User, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { colors, gradients, radius } from '@/theme/tokens';

const tabs: Record<string, { icon: LucideIcon; label: () => string; featured?: boolean }> = {
  index: { icon: House, label: () => t('tabs.home') },
  explore: { icon: Compass, label: () => t('tabs.explore') },
  match: { icon: Sparkles, label: () => t('tabs.match'), featured: true },
  community: { icon: Users, label: () => t('tabs.community') },
  profile: { icon: User, label: () => t('tabs.profile') },
};

/** Floating glass tab bar from the Figma prototype, with AI Match featured in the centre. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const config = tabs[route.name];
          if (!config) return null;
          const focused = state.index === index;
          const Icon = config.icon;
          const label = config.label();

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}>
              {config.featured ? (
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.featured, !focused && { opacity: 0.85 }]}>
                  <Icon size={20} color="#FFFFFF" strokeWidth={2.3} />
                </LinearGradient>
              ) : (
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <Icon size={20} color={focused ? colors.violetLight : colors.textMuted} strokeWidth={focused ? 2.5 : 1.9} />
                </View>
              )}
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? colors.violetLight : colors.textMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.tabBar,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.xl + 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    minHeight: 48,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 36,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.violetSoft,
  },
  featured: {
    width: 40,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
});
