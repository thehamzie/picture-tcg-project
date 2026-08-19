import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Shared tilt source for a focal card — see PLAN.md "Card anatomy & holo effect" and mockup
// 2e ("move your cursor over it: the foil tracks the pointer and the card tilts with it").
// One hook drives both the foil sweep position and the card's own 3D tilt so they can never
// drift out of sync.
//
// Reduced motion: per the product decision recorded in AGENTS.md (flagged, not guessed), a
// reduced-motion device gets a slow gentle auto-cycling sweep instead of tilt reactivity —
// the card body itself stops tilting, only the sheen moves.

const MOTION_UPDATE_INTERVAL_MS = 32; // ~30Hz — smooth for a hue sweep, battery-friendly
const AUTO_CYCLE_DURATION_MS = 9000;
const TILT_SENSITIVITY = 90; // radians of device rotation → 0..100 sweep units

// The mockup's own tilt math, verbatim from the design export's `renderVals()`:
//   rx = (50 - fy) / 6      ry = (fx - 50) / 5
const TILT_X_DIVISOR = 6;
const TILT_Y_DIVISOR = 5;

const SPRING = { damping: 18, stiffness: 140, mass: 0.6 };

export type TiltSource = ReturnType<typeof useTilt>;

export function useTilt(interactive: boolean) {
  // 0..100 across the card, matching the mockup's percentage-based `background-position`.
  const fx = useSharedValue(50);
  const fy = useSharedValue(50);
  const engaged = useSharedValue(0); // 0 = resting flat, 1 = tilted

  useEffect(() => {
    if (!interactive) return;

    let motionSubscription: { remove: () => void } | null = null;
    let reduceMotionSubscription: { remove: () => void } | null = null;
    let cancelled = false;
    let autoCycling = false;

    function startAutoCycle() {
      if (autoCycling) return;
      autoCycling = true;
      motionSubscription?.remove();
      motionSubscription = null;
      engaged.value = withTiming(0, { duration: 300 });
      fx.value = withRepeat(
        withTiming(100, { duration: AUTO_CYCLE_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }

    async function setup() {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;
      if (reduceMotion) return startAutoCycle();

      const available = await DeviceMotion.isAvailableAsync();
      if (cancelled) return;
      if (!available) return startAutoCycle();

      DeviceMotion.setUpdateInterval(MOTION_UPDATE_INTERVAL_MS);
      motionSubscription = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation || autoCycling) return;
        fx.value = clamp(50 + rotation.gamma * TILT_SENSITIVITY);
        fy.value = clamp(50 + rotation.beta * TILT_SENSITIVITY);
        engaged.value = 1;
      });
    }

    setup();
    reduceMotionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (enabled) startAutoCycle();
    });

    return () => {
      cancelled = true;
      motionSubscription?.remove();
      reduceMotionSubscription?.remove();
      cancelAnimation(fx);
      cancelAnimation(fy);
    };
  }, [interactive, fx, fy, engaged]);

  // Touch-drag fallback for simulators, web, and anywhere DeviceMotion is unavailable — and
  // a direct way to play with the foil even on a real device. Opt-out via `interactive` so
  // grid contexts don't attach a Pan that would fight a parent ScrollView.
  const panGesture = Gesture.Pan()
    .enabled(interactive)
    .onBegin(() => {
      engaged.value = withTiming(1, { duration: 120 });
    })
    .onChange((event) => {
      fx.value = clamp(fx.value + (event.changeX / 220) * 100);
      fy.value = clamp(fy.value + (event.changeY / 300) * 100);
    })
    .onFinalize(() => {
      fx.value = withSpring(50, SPRING);
      fy.value = withSpring(50, SPRING);
      engaged.value = withTiming(0, { duration: 260 });
    });

  /** The card body's own 3D tilt, applied by CardFace to the whole card. */
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateX: `${((50 - fy.value) / TILT_X_DIVISOR) * engaged.value}deg` },
      { rotateY: `${((fx.value - 50) / TILT_Y_DIVISOR) * engaged.value}deg` },
    ],
  }));

  return { fx, fy, panGesture, tiltStyle };
}

function clamp(value: number): number {
  'worklet';
  return Math.min(100, Math.max(0, value));
}
