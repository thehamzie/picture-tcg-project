import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { withAlpha } from '../theme/color';
import { cardBackHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { displayRaw, monoRaw } from '../theme/typography';
import { CARD_ASPECT } from './CardFace';

// The face-down card back, from mockups 2a and 2d:
//   radius 12, bg shell.surface, 2px accent border, shadow 0 16px 34px rgba(0,0,0,.5),
//   45° accent hatch, an 88pt ring holding "DP" in Archivo Black, and a "FACE DOWN" caption.
// 2a additionally tilts the whole card `rotate(-3deg)`.
//
// The idle float is not in the static mockup — it's added here because Today's card is the
// screen's only focal object and a face-down card that breathes reads as "waiting to be
// pulled" rather than as a placeholder.

const BASE_WIDTH = 184;
const FLOAT_DURATION_MS = 2600;

type FaceDownCardProps = {
  width: number;
  /** The -3° tilt Today's card sits at. Off for the reveal screen's centered card. */
  tilted?: boolean;
  showLabel?: boolean;
  /** Idle bob. Off during the reveal flip, where the card is already animating. */
  float?: boolean;
};

export default function FaceDownCard({
  width,
  tilted = false,
  showLabel = true,
  float = false,
}: FaceDownCardProps) {
  const { skin } = useSkin();
  const u = width / BASE_WIDTH;
  const styles = useMemo(() => createStyles(skin, u), [skin, u]);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!float) return;
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: FLOAT_DURATION_MS / 2, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: FLOAT_DURATION_MS / 2, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [float, bob]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * u * bob.value },
      { rotate: `${tilted ? -3 + bob.value * 0.8 : 0}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.card, { width, height: width / CARD_ASPECT }, floatStyle]}>
      <View style={[StyleSheet.absoluteFill, cardBackHatch(skin.shell.faceDownHatch)]} />
      <View style={styles.ring}>
        <Text style={styles.monogram}>DP</Text>
      </View>
      {showLabel && <Text style={styles.label}>FACE DOWN</Text>}
    </Animated.View>
  );
}

function createStyles(skin: SkinTokens, u: number) {
  return StyleSheet.create({
    card: {
      borderRadius: Math.round(12 * u),
      backgroundColor: skin.shell.surface,
      borderWidth: Math.max(1, Math.round(2 * u)),
      borderColor: skin.shell.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: [{ offsetX: 0, offsetY: 16 * u, blurRadius: 34 * u, color: 'rgba(0,0,0,0.5)' }],
    },
    ring: {
      width: Math.round(88 * u),
      height: Math.round(88 * u),
      borderRadius: Math.round(44 * u),
      borderWidth: Math.max(1, Math.round(2 * u)),
      borderColor: withAlpha(skin.shell.accent, 0.55),
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogram: {
      ...displayRaw(22 * u),
      color: skin.shell.accent,
    },
    label: {
      ...monoRaw(8.5 * u, 0.18),
      position: 'absolute',
      bottom: 13 * u,
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
  });
}
