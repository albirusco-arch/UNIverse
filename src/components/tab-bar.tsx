import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Briefcase, Compass, House, MessageCircle, Users, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { t } from '@/i18n';
import { colors, radius } from '@/theme/tokens';

// The AI research tab stays a route (opened from Home and university pages) but has no button here.
const tabs: Record<string, { icon: LucideIcon; label: () => string }> = {
  index: { icon: House, label: () => t('tabs.home') },
  explore: { icon: Compass, label: () => t('tabs.explore') },
  opportunities: { icon: Briefcase, label: () => t('tabs.opportunities') },
  community: { icon: Users, label: () => t('tabs.community') },
  groups: { icon: MessageCircle, label: () => t('tabs.groups') },
};

/** Minimal floating tab bar. */
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
              <View style={styles.iconWrap}>
                <Icon size={20} color={focused ? colors.text : colors.textMuted} strokeWidth={focused ? 2.4 : 1.8} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? colors.text : colors.textMuted }]}>
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
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 6,
    paddingHorizontal: 6,
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
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
