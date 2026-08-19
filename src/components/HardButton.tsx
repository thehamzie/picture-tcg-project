import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, s } from '../theme/typography';

// The mockup's primary CTA is a physical-feeling key: a flat gold slab sitting on a solid
// offset shadow (`box-shadow: 0 5px 0 #A9761C`) rather than a soft blur. Pressing it slides
// the slab down onto its shadow, which is the obvious extension of that treatment and the
// kind of tactility the "trading card" framing wants.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HardButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** Depth of the solid offset shadow. Mockup uses 5 for full-width CTAs, 4 for Share. */
  depth?: number;
  height?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
};

export default function HardButton({
  label,
  onPress,
  variant = 'primary',
  depth = 5,
  height = 54,
  disabled = false,
  style,
  fontSize = 15,
}: HardButtonProps) {
  const { skin } = useSkin();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const pressed = useSharedValue(0);
  const shadowDepth = s(depth);

  const slabStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * shadowDepth }],
  }));

  const isPrimary = variant === 'primary';

  return (
    <View style={[{ height: s(height) + shadowDepth }, style]}>
      {isPrimary && (
        <View
          style={[
            styles.shadowSlab,
            { top: shadowDepth, height: s(height), backgroundColor: skin.shell.accentShadow },
          ]}
        />
      )}
      <AnimatedPressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 70 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 120 });
        }}
        style={[
          styles.slab,
          isPrimary ? { backgroundColor: skin.shell.accent } : styles.secondaryFill,
          { height: s(height) },
          disabled && styles.disabled,
          slabStyle,
        ]}
      >
        <Text
          style={
            isPrimary
              ? [styles.primaryLabel, { fontSize: s(fontSize), letterSpacing: s(fontSize * 0.03) }]
              : [styles.secondaryLabel, { fontSize: s(fontSize * 0.75) }]
          }
        >
          {label}
        </Text>
      </AnimatedPressable>
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    shadowSlab: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderRadius: s(9),
    },
    slab: {
      borderRadius: s(9),
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryFill: {
      // Mockup's `rgba(244,236,220,.09)` — the shell's own text color at low alpha, which
      // stays correct on the one light skin too (where textPrimary is a dark ink).
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.09),
    },
    disabled: {
      opacity: 0.55,
    },
    primaryLabel: {
      ...display(15),
      color: skin.shell.onAccent,
    },
    secondaryLabel: {
      ...body(11, 600),
      letterSpacing: s(0.9),
      textTransform: 'uppercase',
      color: skin.shell.textPrimary,
    },
  });
}
