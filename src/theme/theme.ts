import type { Ionicons } from '@expo/vector-icons';

// Vibe/type palette. These five hexes are CONFIRMED — read directly out of the reveal screen
// (2d) and card-object-study (2e) markup in design-reference/"Daily Pull - Screens
// (standalone).html", and cross-checked against the binder-grid vibe bars in 2f. They stay
// constant across all four binder skins (PLAN.md "Binder skins").
//
// The previous values here were noticeably desaturated versions of these (e.g. golden was
// #BA7517 against the mockup's #F2A007), which is a large part of why the built app read
// muddy next to the reference.
export const vibeColors = {
  golden: '#F2A007',
  calm: '#12B37A',
  together: '#EE3F76',
  adventure: '#F2571C',
  cozy: '#6C63E8',
} as const;

export type VibeType = keyof typeof vibeColors;

/** Short caps labels as they appear on the reveal screen's vibe picker (2d). */
export const vibeLabels: Record<VibeType, string> = {
  golden: 'GOLDEN',
  calm: 'CALM',
  together: 'TOGETHER',
  adventure: 'ADVENT.',
  cozy: 'COZY',
};

/** Order is fixed by the mockup's picker row, left to right. */
export const VIBE_ORDER: VibeType[] = ['golden', 'calm', 'together', 'adventure', 'cozy'];

export const vibeIcons: Record<VibeType, keyof typeof Ionicons.glyphMap> = {
  golden: 'sunny',
  calm: 'moon',
  together: 'heart',
  adventure: 'flash',
  cozy: 'cafe',
};

export const holoShimmerColors = Object.values(vibeColors);

/**
 * The diagonal hatch the mockup paints into every empty photo placeholder
 * (`repeating-linear-gradient(135deg, rgba(23,19,15,.12) 0 4px, transparent 4px 9px)`) and
 * into the face-down card back at 45°. Rendered by components/HatchPattern.tsx.
 */
export const hatch = {
  placeholderColor: 'rgba(23,19,15,0.12)',
  placeholderBase: '#C9BCA3',
  angleDeg: 135,
};

export const cardShape = {
  /** Overall card silhouette. The square photo window + info plate resolve to this ratio. */
  aspectRatio: 5 / 7,
  radiusGrid: 6,
  radiusFull: 12,
};

export const theme = {
  colors: {
    vibe: vibeColors,
    /** Fixed white, used for text/icons drawn on top of a vibe- or accent-colored surface. */
    onColor: '#FFFFFF',
  },
  vibeIcons,
  vibeLabels,
  holoShimmerColors,
  cardShape,
};

export type Theme = typeof theme;
