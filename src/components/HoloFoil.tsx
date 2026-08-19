import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { foilGrain, foilSweep } from '../theme/gradients';
import type { FoilRampTokens } from '../theme/skins';
import { useIsCapturing } from './CaptureContext';

// The two-layer foil, confirmed from mockup 2e:
//
//   <div style="position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;
//     background-image:linear-gradient(112deg,transparent 18%,…,transparent 78%);
//     background-size:260% 260%;background-position:{{ foilPos }}"></div>
//   <div style="position:absolute;inset:0;pointer-events:none;opacity:.22;
//     mix-blend-mode:overlay;
//     background:repeating-linear-gradient(74deg,rgba(255,255,255,.7) 0 1px,transparent 1px 5px)"></div>
//
// RN 0.81 supports `mixBlendMode` and gradient `experimental_backgroundImage` natively, so
// both layers are the real thing rather than an approximation. `background-size: 260%` has
// no RN equivalent, so the sweep layer is a 260%-sized child translated by the tilt instead
// — which is exactly what `background-position` does to an oversized background.
//
// Note the foil covers the whole card face, not just the photo window. That's what both 2d
// and 2e show (the layers are children of the card root, at `inset: 0`), and on the light
// cardstock the overlay blend reads as a soft tint rather than a wash.

const SWEEP_SCALE = 2.6; // the source's `background-size: 260% 260%`

// While rasterizing, `mixBlendMode` is swapped for plain alpha (see CaptureContext for why).
// `overlay` against the light cardstock lands close to a ~0.5-alpha screen, so these are
// tuned to read like the on-screen foil rather than to be mathematically equivalent.
const CAPTURE_SWEEP_OPACITY = 0.55;
const CAPTURE_GRAIN_OPACITY_FACTOR = 0.8;

type HoloFoilProps = {
  foilRamp: FoilRampTokens;
  /** 0..100 sweep position from `useTilt`. Omit for a static, centered sheen. */
  fx?: SharedValue<number>;
  fy?: SharedValue<number>;
  /** Matches the parent's corner radius so the sheen doesn't square off the card corners. */
  borderRadius?: number;
};

export default function HoloFoil({ foilRamp, fx, fy, borderRadius = 0 }: HoloFoilProps) {
  const capturing = useIsCapturing();
  // Measured rather than expressed in percentages: an oversized child translated by a
  // percentage of *itself* is easy to get subtly wrong, and percentage transforms have
  // patchier support than plain pixel offsets across RN versions.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const travelX = size.width * (SWEEP_SCALE - 1);
  const travelY = size.height * (SWEEP_SCALE - 1);

  const sweepStyle = useAnimatedStyle(() => {
    const x = fx ? fx.value : 50;
    const y = fy ? fy.value : 50;
    return {
      transform: [
        { translateX: -(x / 100) * travelX },
        { translateY: -(y / 100) * travelY },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
            ? current
            : { width, height }
        );
      }}
    >
      <Animated.View
        style={[
          styles.sweepLayer,
          { width: size.width * SWEEP_SCALE, height: size.height * SWEEP_SCALE },
          capturing ? { opacity: CAPTURE_SWEEP_OPACITY } : styles.blend,
          sweepStyle,
        ]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, foilSweep(foilRamp.sweep, foilRamp.sweepLocations)]}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          capturing ? null : styles.blend,
          { opacity: foilRamp.grainOpacity * (capturing ? CAPTURE_GRAIN_OPACITY_FACTOR : 1) },
          // The grain scales with the card. Quoted in absolute pixels it would be a visible
          // texture on a 200pt card and an invisible hairline on an exported one.
          foilGrain(foilRamp.grainAngleDeg, Math.max(0.6, size.width / 250)),
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  sweepLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  blend: {
    mixBlendMode: 'overlay',
  },
});
