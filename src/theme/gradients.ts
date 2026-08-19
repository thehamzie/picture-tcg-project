// CSS-gradient helpers.
//
// React Native 0.81 (New Architecture) supports `experimental_backgroundImage`, `boxShadow`,
// `isolation` and `mixBlendMode` as real style props, so the mockup's gradients and blend
// modes are reproduced rather than approximated.
//
// Two notes on how these are emitted:
//  * They're CSS *strings*, not the object form. RN's hand-written `.d.ts` mistypes a color
//    stop's `positions` as `string[][]` where the runtime (and the generated types) expect
//    `string[]`, which makes the object form fail to typecheck. The string form takes the
//    same path through `processBackgroundImage.js` and sidesteps that.
//  * RN's parser only accepts `linear-gradient` / `radial-gradient` — there is no
//    `repeating-linear-gradient` — so `repeatingStripes` unrolls one into explicit stops. It
//    does use the double-position shorthand (`color 0px 4px`), which the parser handles.

import type { ViewStyle } from 'react-native';

function backgroundImage(css: string): ViewStyle {
  return { experimental_backgroundImage: css };
}

/**
 * Unrolls a CSS `repeating-linear-gradient(<angle>, <color> 0 <stripe>px, transparent
 * <stripe>px <period>px)` into the explicit stop list RN needs.
 *
 * `length` is how far along the gradient line to keep repeating — it only needs to exceed the
 * element's diagonal; stops past the edge are simply unused.
 */
export function repeatingStripes({
  angleDeg,
  color,
  stripe,
  period,
  length = 640,
}: {
  angleDeg: number;
  color: string;
  stripe: number;
  period: number;
  length?: number;
}): ViewStyle {
  const repeats = Math.ceil(length / period);
  const stops: string[] = [];
  for (let i = 0; i < repeats; i++) {
    const start = i * period;
    stops.push(`${color} ${start}px ${start + stripe}px`);
    stops.push(`transparent ${start + stripe}px ${start + period}px`);
  }
  return backgroundImage(`linear-gradient(${angleDeg}deg, ${stops.join(', ')})`);
}

/**
 * The diagonal hatch behind every empty photo placeholder:
 * `repeating-linear-gradient(135deg, rgba(23,19,15,.12) 0 4px, transparent 4px 9px)`.
 * `scale` bumps stripe and period together — the mockup uses 4/9 in the grid, 5/11 on the fan
 * cards and 6/13 on the reveal card, all the same pattern at different sizes.
 */
export function placeholderHatch(color = 'rgba(23,19,15,0.12)', scale = 1): ViewStyle {
  return repeatingStripes({ angleDeg: 135, color, stripe: 4 * scale, period: 9 * scale });
}

/**
 * The 45° hatch on the face-down card back:
 * `repeating-linear-gradient(45deg, rgba(224,163,46,.13) 0 7px, transparent 7px 15px)`.
 */
export function cardBackHatch(color: string): ViewStyle {
  return repeatingStripes({ angleDeg: 45, color, stripe: 7, period: 15 });
}

/**
 * The foil's fixed grain layer — confirmed from the card-object-study render (2e):
 * `repeating-linear-gradient(74deg, rgba(255,255,255,.7) 0 1px, transparent 1px 5px)` at
 * `opacity: .22`. White and universal, not skin-tinted.
 */
export function foilGrain(angleDeg: number): ViewStyle {
  return repeatingStripes({ angleDeg, color: 'rgba(255,255,255,0.7)', stripe: 1, period: 5, length: 800 });
}

/**
 * The foil hue sweep. Source (2e):
 * `linear-gradient(112deg, transparent 18%, rgba(255,255,255,.85) 32%, …, transparent 78%)`.
 * Stop positions come from the skin's `foilRamp.sweepLocations`, so a skin can shift them.
 */
export function foilSweep(colors: readonly string[], locations: readonly number[]): ViewStyle {
  const stops = colors.map((color, index) => {
    const position = locations[index] ?? index / Math.max(1, colors.length - 1);
    return `${color} ${(position * 100).toFixed(1)}%`;
  });
  return backgroundImage(`linear-gradient(112deg, ${stops.join(', ')})`);
}

/** A plain multi-stop linear gradient, for skin swatches and small accents. */
export function linearGradient(colors: readonly string[], angleDeg = 150): ViewStyle {
  if (colors.length === 1) return { backgroundColor: colors[0] };
  return backgroundImage(`linear-gradient(${angleDeg}deg, ${colors.join(', ')})`);
}
