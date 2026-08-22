import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { withAlpha } from '../theme/color';
import { useSkin } from '../theme/SkinContext';
import { s } from '../theme/typography';

// A real drag slider, matching mockup 2c's manual controls:
//   track  height:3px; border-radius:2px; background:rgba(244,236,220,.18)
//   fill   background: accent
//   knob   13px circle, #F4ECDC, centered on the fill's end
//
// AGENTS.md previously recorded the manual controls as discrete tap-stops because a real
// slider would have meant a new dependency — react-native-gesture-handler is already here, so
// this is a ~60-line component rather than a dependency, and the mockup does say "sliders".

type SliderProps = {
  /** Current position, 0..1. */
  value: number;
  onChange: (next: number) => void;
  /** Snap to N evenly spaced steps. Omit for continuous. */
  steps?: number;
  orientation?: 'horizontal' | 'vertical';
  length?: number;
  disabled?: boolean;
  /** What this slider controls, for screen readers. */
  label?: string;
  /** The current value spoken aloud, e.g. "+1.0 EV" — more use than a percentage. */
  valueText?: string;
};

const KNOB = 13;

// Resolved on the JS thread at module load, NOT inside `knobStyle`'s worklet. `s()` is an
// ordinary imported function; calling it from a worklet running on the UI runtime throws "tried
// to synchronously call a non-worklet function", which surfaces as a hard native crash with no
// JS error rather than something the ErrorBoundary can catch.
const KNOB_HALF = s(KNOB) / 2;

const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

export default function Slider({
  value,
  onChange,
  steps,
  orientation = 'horizontal',
  length,
  disabled = false,
  label,
  valueText,
}: SliderProps) {
  const { skin } = useSkin();
  const [extent, setExtent] = useState(0);
  const progress = useSharedValue(value);
  const isVertical = orientation === 'vertical';

  // Keep the worklet's copy in step with prop-driven changes (e.g. a Reset button).
  useEffect(() => {
    progress.value = value;
  }, [value, progress]);

  function commit(next: number) {
    const clamped = Math.min(1, Math.max(0, next));
    const snapped = steps && steps > 1 ? Math.round(clamped * (steps - 1)) / (steps - 1) : clamped;
    onChange(snapped);
  }

  const pan = Gesture.Pan()
    .enabled(!disabled && extent > 0)
    .onBegin((event) => {
      const position = isVertical ? 1 - event.y / extent : event.x / extent;
      progress.value = Math.min(1, Math.max(0, position));
      runOnJS(commit)(progress.value);
    })
    .onChange((event) => {
      const delta = isVertical ? -event.changeY / extent : event.changeX / extent;
      progress.value = Math.min(1, Math.max(0, progress.value + delta));
      runOnJS(commit)(progress.value);
    });

  const fillStyle = useAnimatedStyle(() =>
    isVertical ? { height: `${progress.value * 100}%` } : { width: `${progress.value * 100}%` }
  );
  const knobStyle = useAnimatedStyle(() =>
    isVertical
      ? { bottom: `${progress.value * 100}%`, marginBottom: -KNOB_HALF }
      : { left: `${progress.value * 100}%`, marginLeft: -KNOB_HALF }
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[
          isVertical ? styles.vTouch : styles.hTouch,
          isVertical && length != null ? { height: length } : null,
          disabled && styles.disabled,
        ]}
        // A drag gesture is invisible to a screen reader, so the slider also exposes itself as
        // an adjustable with increment/decrement — which is how VoiceOver and TalkBack drive
        // one, by swiping up and down rather than along the track.
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={
          valueText ? { text: valueText } : { min: 0, max: 100, now: Math.round(value * 100) }
        }
        accessibilityActions={ADJUST_ACTIONS}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          const step = steps && steps > 1 ? 1 / (steps - 1) : 0.05;
          if (event.nativeEvent.actionName === 'increment') commit(value + step);
          if (event.nativeEvent.actionName === 'decrement') commit(value - step);
        }}
        onLayout={(event) =>
          setExtent(isVertical ? event.nativeEvent.layout.height : event.nativeEvent.layout.width)
        }
      >
        <View
          style={[
            isVertical ? styles.vTrack : styles.hTrack,
            { backgroundColor: withAlpha(skin.shell.textPrimary, 0.18) },
          ]}
        >
          <Animated.View
            style={[
              isVertical ? styles.vFill : styles.hFill,
              { backgroundColor: skin.shell.accent },
              fillStyle,
            ]}
          />
          <Animated.View
            style={[styles.knob, { backgroundColor: skin.shell.textPrimary }, knobStyle]}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // The touch targets are taller/wider than the 3px track so the control is actually grabbable.
  hTouch: {
    height: s(28),
    justifyContent: 'center',
  },
  vTouch: {
    width: s(28),
    alignItems: 'center',
  },
  hTrack: {
    height: s(3),
    borderRadius: s(2),
    justifyContent: 'center',
  },
  vTrack: {
    flex: 1,
    width: s(3),
    borderRadius: s(2),
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  hFill: {
    height: '100%',
    borderRadius: s(2),
  },
  vFill: {
    width: '100%',
    borderRadius: s(2),
  },
  knob: {
    position: 'absolute',
    width: s(KNOB),
    height: s(KNOB),
    borderRadius: s(KNOB / 2),
    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: 'rgba(0,0,0,0.5)' }],
  },
  disabled: {
    opacity: 0.4,
  },
});
