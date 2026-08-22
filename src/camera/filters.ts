import {
  channels,
  compose,
  contrast,
  duotone,
  exposure,
  fade,
  IDENTITY,
  saturation,
  temperature,
  type ColorMatrix,
} from './colorMatrix';

// The filter pack.
//
// A preset is a colour matrix plus optional grain and vignette. That is the whole filter, and
// it is applied for real — by `camera/develop.ts`, on the captured still, in DevelopScreen.
//
// Filters are chosen in **one** place: the develop screen, after the shutter. The camera screen
// has no filter concept at all.
//
// That is a deliberate simplification, not an omission. Three attempts at a live-filtered
// viewfinder failed on device (flat tints can't desaturate; `mixBlendMode` composites
// unreliably over a native preview and falls back to opaque; React Native's `filter` prop
// forces its view offscreen and breaks the camera surface outright), so a filter picked on the
// camera could never be shown there — which left two pickers where only the later one told the
// truth. One picker, in the place that can show what it does.
//
// The first five presets and their swatches are the mockup's own (2b). The rest are new.

export type FilterDef = {
  id: string;
  /** Kept to five characters or fewer — the strip renders these in mono caps at ~7.5pt. */
  label: string;
  swatch: string;
  matrix: ColorMatrix;
  /** Baked film grain, 0..1. Added to whatever the user dials in on the grain slider. */
  grain?: number;
  /** Corner falloff, 0..1. */
  vignette?: number;
};

export const FILTERS: FilterDef[] = [
  {
    id: 'none',
    label: 'NONE',
    swatch: '#C9BCA3',
    matrix: IDENTITY,
  },
  {
    // Warm consumer film: amber highlights, a touch of green in the shadows, punchy.
    id: 'koda',
    label: 'KODA',
    swatch: '#C9A87F',
    matrix: compose(
      temperature(0.42),
      contrast(0.16),
      saturation(1.14),
      channels([1, 1.02, 0.97], [0.008, 0.014, 0])
    ),
    grain: 0.16,
    vignette: 0.14,
  },
  {
    // Lifted blacks, drained colour, faintly cool. The washed-out one.
    id: 'fade',
    label: 'FADE',
    swatch: '#8FA79A',
    matrix: compose(
      saturation(0.72),
      fade(0.68, [0.92, 1, 1.06]),
      contrast(-0.06),
      temperature(-0.12)
    ),
    grain: 0.1,
  },
  {
    id: 'disco',
    label: 'DISCO',
    swatch: '#B98C9B',
    matrix: compose(
      saturation(1.32),
      channels([1.08, 0.97, 1.06], [0.012, 0, 0.02]),
      contrast(0.12)
    ),
    vignette: 0.2,
  },
  {
    // Desaturated but not monochrome — the mockup's swatch is a warm grey, not black.
    id: 'grey',
    label: 'GREY',
    swatch: '#9A937F',
    matrix: compose(saturation(0.18), contrast(0.1), channels([1.01, 1, 0.99])),
    grain: 0.12,
  },
  {
    // True black and white, hard.
    id: 'noir',
    label: 'NOIR',
    swatch: '#2B2B2B',
    matrix: compose(saturation(0), contrast(0.34)),
    grain: 0.24,
    vignette: 0.28,
  },
  {
    id: 'sun',
    label: 'SUN',
    swatch: '#E8A83C',
    matrix: compose(
      temperature(0.6),
      channels([1.05, 1.01, 0.94], [0.03, 0.018, 0]),
      saturation(1.1),
      contrast(0.06)
    ),
  },
  {
    id: 'frost',
    label: 'FROST',
    swatch: '#8FB6CE',
    matrix: compose(
      temperature(-0.55),
      contrast(0.18),
      saturation(0.92),
      channels([0.97, 1, 1.05], [0, 0.006, 0.018])
    ),
  },
  {
    // Dusty, warm, and grainy — the most "found in a drawer" of the set.
    id: 'dust',
    label: 'DUST',
    swatch: '#B49A78',
    matrix: compose(
      temperature(0.3),
      saturation(0.68),
      fade(0.55, [1.06, 1, 0.9]),
      contrast(-0.04)
    ),
    grain: 0.34,
    vignette: 0.22,
  },
  {
    id: 'pine',
    label: 'PINE',
    swatch: '#6E8B6A',
    matrix: compose(
      saturation(0.82),
      channels([0.95, 1.04, 0.96], [0, 0.012, 0.006]),
      contrast(0.12),
      temperature(-0.1)
    ),
    grain: 0.1,
  },
  {
    // Soft, high-key, pink in the highlights.
    id: 'bloom',
    label: 'BLOOM',
    swatch: '#E6A9B4',
    matrix: compose(
      channels([1.06, 0.99, 1.02], [0.026, 0.014, 0.02]),
      contrast(-0.1),
      saturation(1.05),
      fade(0.3, [1.1, 0.96, 1])
    ),
  },
  {
    id: 'sepia',
    label: 'SEPIA',
    swatch: '#A8845A',
    matrix: compose(duotone([1.07, 0.88, 0.65], 0.95), contrast(0.14)),
    grain: 0.18,
    vignette: 0.2,
  },
  {
    id: 'neon',
    label: 'NEON',
    swatch: '#7B5CE6',
    matrix: compose(
      saturation(1.5),
      channels([1.02, 0.98, 1.1], [0, 0, 0.03]),
      contrast(0.24)
    ),
    vignette: 0.3,
  },
  {
    id: 'slate',
    label: 'SLATE',
    swatch: '#77808A',
    matrix: compose(
      saturation(0.4),
      temperature(-0.28),
      contrast(0.26),
      channels([0.98, 1, 1.03])
    ),
    grain: 0.14,
  },
  {
    id: 'honey',
    label: 'HONEY',
    swatch: '#D08B2C',
    matrix: compose(
      temperature(0.5),
      saturation(1.22),
      contrast(0.2),
      channels([1.03, 0.99, 0.92], [0.014, 0.006, 0])
    ),
    vignette: 0.24,
  },
];

export type FilterId = (typeof FILTERS)[number]['id'];

export const DEFAULT_FILTER_ID = 'none';

export function getFilter(id: string | null | undefined): FilterDef {
  return FILTERS.find((filter) => filter.id === id) ?? FILTERS[0];
}

/**
 * The develop settings, all normalised to 0..1 so the sliders can drive them directly. The
 * midpoint of each is "no change", which is why the camera resets to 0.5 rather than 0.
 */
export type DevelopRecipe = {
  filterId: string;
  /** 0..1 maps to -2..+2 EV. */
  exposure: number;
  /** 0..1 maps to -0.5..+0.5 contrast. */
  contrast: number;
  /** 0..1 maps to 0..2 saturation. */
  saturation: number;
  /** 0..1 maps to -1..+1 (cool..warm). */
  warmth: number;
  /** 0..1, additive over the preset's own grain. */
  grain: number;
};

export const NEUTRAL_RECIPE: DevelopRecipe = {
  filterId: DEFAULT_FILTER_ID,
  exposure: 0.5,
  contrast: 0.5,
  saturation: 0.5,
  warmth: 0.5,
  grain: 0,
};

/** Maps a 0..1 slider onto a symmetric range centred on 0.5. */
const spread = (value: number, extent: number) => (value - 0.5) * 2 * extent;

export const recipeReadouts = {
  exposure: (value: number) => `${spread(value, 2) >= 0 ? '+' : ''}${spread(value, 2).toFixed(1)} EV`,
  contrast: (value: number) => formatSigned(spread(value, 50)),
  saturation: (value: number) => formatSigned(spread(value, 50)),
  warmth: (value: number) => formatSigned(spread(value, 50)),
  grain: (value: number) => `${Math.round(value * 100)}%`,
};

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

/**
 * Collapses a preset and the user's adjustments into the single colour matrix that gets baked
 * into the photo. Order matters: the preset defines the film, then the user's exposure and
 * white balance sit on top of it, the way a develop step follows a stock choice.
 */
export function buildDevelopMatrix(recipe: DevelopRecipe): ColorMatrix {
  const filter = getFilter(recipe.filterId);
  return compose(
    filter.matrix,
    exposure(spread(recipe.exposure, 2)),
    temperature(spread(recipe.warmth, 1)),
    contrast(spread(recipe.contrast, 0.5)),
    saturation(1 + spread(recipe.saturation, 1))
  );
}

/** Total grain to bake: the preset's own, plus whatever the user added. */
export function totalGrain(recipe: DevelopRecipe): number {
  return Math.min(1, (getFilter(recipe.filterId).grain ?? 0) + recipe.grain);
}

export function totalVignette(recipe: DevelopRecipe): number {
  return getFilter(recipe.filterId).vignette ?? 0;
}

/** True when nothing would change the pixels — lets the capture path skip a GPU pass entirely. */
export function isNeutral(recipe: DevelopRecipe): boolean {
  return (
    recipe.filterId === DEFAULT_FILTER_ID &&
    recipe.exposure === 0.5 &&
    recipe.contrast === 0.5 &&
    recipe.saturation === 0.5 &&
    recipe.warmth === 0.5 &&
    recipe.grain === 0
  );
}
