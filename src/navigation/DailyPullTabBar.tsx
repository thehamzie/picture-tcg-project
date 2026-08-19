import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, hairline, s } from '../theme/typography';

// The mockup's tab bar (visible in 2a and 2f) is deliberately plain: no icons, no pill, no
// background fill — just three tracked-out uppercase labels above a hairline rule.
//
//   display:flex; justify-content:space-around; padding:16px 22px 20px;
//   border-top:1px solid rgba(244,236,220,.1);
//   font:600 10px Archivo; letter-spacing:.14em;
//   active #F4ECDC, inactive rgba(244,236,220,.35)
//
// The underline that slides in under the active label is an addition — the static mockup
// can't show a transition, and without one the only state change is a color swap.

export default function DailyPullTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  return (
    <View style={[styles.bar, { paddingBottom: s(20) + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.tabBarLabel ?? options.title ?? route.name).toString();
        const focused = state.index === index;

        return (
          <TabItem
            key={route.key}
            label={label}
            focused={focused}
            styles={styles}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label,
  focused,
  styles,
  onPress,
}: {
  label: string;
  focused: boolean;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, progress]);

  const underlineStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.4 + progress.value * 0.6 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      onPress={onPress}
      style={styles.tab}
      hitSlop={10}
    >
      <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>{label}</Text>
      <Animated.View style={[styles.underline, underlineStyle]} />
    </Pressable>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: s(22),
      paddingTop: s(16),
      borderTopWidth: hairline,
      borderTopColor: skin.shell.border,
      backgroundColor: skin.shell.background,
    },
    tab: {
      alignItems: 'center',
      gap: s(5),
    },
    label: {
      ...body(10, 600),
      letterSpacing: s(1.4),
      textTransform: 'uppercase',
    },
    labelActive: {
      color: skin.shell.textPrimary,
    },
    labelInactive: {
      color: skin.shell.textTertiary,
    },
    underline: {
      height: s(2),
      width: s(18),
      borderRadius: s(1),
      backgroundColor: skin.shell.accent,
    },
  });
}
