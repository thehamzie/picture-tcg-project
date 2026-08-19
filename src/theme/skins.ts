// Binder skin token sets — see PLAN.md "Binder skins" and CLAUDE.md "Skins are tokens, not
// forks." Every skin fills the same shell/page/cardstock/foilRamp shape; adding a skin means
// adding a token set here, never a per-skin branch in a screen.
//
// Values are extracted from design-reference/"Daily Pull - Screens (standalone).html" (the
// JSON-escaped Claude Design export, whose inline styles carry exact hex/rgba/gradient
// values) and cross-checked against daily-pull-screens.png. All 7 full-size example screens
// render Warm Binder, so its values are CONFIRMED. The other 3 skins appear only as a
// 4-swatch preview chip (shell / page / cardstock / foil, in that order) plus a one-line
// descriptor in the skin-selector screen (2i), so their remaining fields are ESTIMATED by
// analogy to Warm Binder's confirmed structure — each is marked individually below.

export type SkinId =
  | 'warmBinder'
  | 'cardShop97'
  | 'scrapbookSun'
  | 'foilArcade'
  // The four below are NOT from the design source — the mockup only ever shows the original
  // four. They're new token sets built to the same structure, which is the whole point of
  // "skins are tokens, not forks": a new one is a config entry, not a design pass.
  | 'midnightInk'
  | 'sakuraPress'
  | 'forestPress'
  | 'monoPress';

export type ShellTokens = {
  background: string;
  /** Raised surfaces on the shell: face-down card body, export photo stage, page spine. */
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  /** Further-muted tertiary, for inactive tab labels and the faintest captions. */
  textTertiary: string;
  accent: string;
  /** Brighter sibling of the accent, used for the streak count and its pip row (2a). */
  highlight: string;
  /** Text/icon color on top of `accent`. The mockup's gold CTA uses dark ink, not white. */
  onAccent: string;
  /** The solid offset "hard shadow" under a primary button (`box-shadow: 0 5px 0 …`). */
  accentShadow: string;
  /** Translucent fill used for the face-down card's diagonal hatch. */
  faceDownHatch: string;
};

export type PageTokens = {
  /** The binder page itself — the cream leaf that card slots sit on. */
  background: string;
  /** Dark ink for text printed on the page (set number, date range). */
  ink: string;
  /** The punched ring holes down the page's left edge. */
  ring: string;
  /** The two stacked page edges peeking out to the right of the current page. */
  spine: string;
  spineBack: string;
  texture: 'none' | 'halftone';
};

export type CardstockTokens = {
  base: string; // matte card body / non-holo "Common" finish
  /** The inner mat between the 2px ink rule and the photo (mockup: #EFE4CC). */
  mat: string;
  border: string; // 2px ink-rule border around the photo
  inkRule: string; // mono date/rarity label + rule color
  /** Fill shown where a photo would be, before one loads / for empty slots. */
  photoPlaceholder: string;
};

export type FoilRampTokens = {
  sweep: string[]; // gradient stop colors for the tilt-reactive hue-sweep layer
  sweepLocations: number[]; // 0..1 stop positions, same length as `sweep` (uneven in source)
  grainAngleDeg: number; // fixed grain-overlay angle (74° — confirmed)
  grainOpacity: number; // confirmed at 0.22 in the source; applied to all skins
  labelColor: string; // "◆ HOLO" label color, shown on the light cardstock
};

export type SkinTokens = {
  id: SkinId;
  name: string;
  /** The one-line descriptor under the name in the skin selector (2i). */
  descriptor: string;
  shell: ShellTokens;
  page: PageTokens;
  cardstock: CardstockTokens;
  foilRamp: FoilRampTokens;
};

export const DEFAULT_SKIN_ID: SkinId = 'warmBinder';

// CONFIRMED — the full sweep from the card-object-study render (2e), the most complete single
// instance in the source:
//   linear-gradient(112deg, transparent 18%, rgba(255,255,255,.85) 32%, rgba(255,196,90,.8)
//   42%, rgba(110,230,255,.75) 52%, rgba(255,110,200,.65) 62%, transparent 78%)
// Reused for Card Shop '97, whose own selector swatch shows the identical gold (#E0A32E) and
// which PLAN.md labels "gold foil" — justified, but not independently confirmed.
const GOLD_FOIL_SWEEP = [
  'transparent',
  'rgba(255,255,255,0.85)',
  'rgba(255,196,90,0.8)',
  'rgba(110,230,255,0.75)',
  'rgba(255,110,200,0.65)',
  'transparent',
];
const GOLD_FOIL_SWEEP_LOCATIONS = [0.18, 0.32, 0.42, 0.52, 0.62, 0.78];

export const SKINS: Record<SkinId, SkinTokens> = {
  warmBinder: {
    id: 'warmBinder',
    name: 'Warm Binder',
    descriptor: 'DEFAULT',
    shell: {
      background: '#17130F', // CONFIRMED
      surface: '#241C15', // CONFIRMED (face-down card body, export photo stage, page spine)
      border: 'rgba(244,236,220,0.1)', // CONFIRMED (tab-bar rule)
      textPrimary: '#F4ECDC', // CONFIRMED
      textSecondary: 'rgba(244,236,220,0.5)', // CONFIRMED
      textTertiary: 'rgba(244,236,220,0.35)', // CONFIRMED (inactive tab labels)
      accent: '#E0A32E', // CONFIRMED
      highlight: '#F2A007', // CONFIRMED (streak number + filled streak pips are a brighter gold)
      onAccent: '#17130F', // CONFIRMED (dark ink on the gold CTA, not white)
      accentShadow: '#A9761C', // CONFIRMED (`box-shadow: 0 5px 0 #A9761C`)
      faceDownHatch: 'rgba(224,163,46,0.13)', // CONFIRMED (45° hatch on the card back)
    },
    page: {
      background: '#E8D9BE', // CONFIRMED (binder page + set-complete page)
      ink: '#17130F', // CONFIRMED
      ring: '#17130F', // CONFIRMED (9px punched holes)
      spine: '#2C231A', // CONFIRMED (outer page edge)
      spineBack: '#241C15', // CONFIRMED (inner page edge)
      texture: 'none',
    },
    cardstock: {
      base: '#FAF3E4', // CONFIRMED
      mat: '#EFE4CC', // CONFIRMED (inner mat inside the ink rule)
      border: '#17130F', // CONFIRMED (2px ink rule)
      inkRule: '#17130F', // CONFIRMED
      photoPlaceholder: '#C9BCA3', // CONFIRMED
    },
    foilRamp: {
      sweep: GOLD_FOIL_SWEEP,
      sweepLocations: GOLD_FOIL_SWEEP_LOCATIONS,
      grainAngleDeg: 74, // CONFIRMED
      grainOpacity: 0.22, // CONFIRMED
      labelColor: '#B07A0E', // CONFIRMED ("◆ HOLO" on cardstock)
    },
  },
  cardShop97: {
    id: 'cardShop97',
    name: "Card Shop '97",
    descriptor: 'COOL INK · GOLD FOIL', // CONFIRMED (selector copy)
    shell: {
      background: '#16141C', // CONFIRMED (selector swatch 1)
      surface: '#221E2B', // CONFIRMED (selector swatch 2)
      border: 'rgba(244,236,220,0.1)', // ESTIMATED — Warm Binder's rule, unchanged
      textPrimary: '#F4ECDC', // CONFIRMED (selector swatch 3 is the cardstock #F4ECDC; reused as text)
      textSecondary: 'rgba(244,236,220,0.5)', // ESTIMATED
      textTertiary: 'rgba(244,236,220,0.35)', // ESTIMATED
      accent: '#E0A32E', // CONFIRMED (selector swatch 4, matches "GOLD FOIL")
      highlight: '#F2A007', // ESTIMATED — same gold family as Warm Binder
      onAccent: '#16141C', // ESTIMATED — following Warm Binder (dark ink on gold)
      accentShadow: '#A9761C', // ESTIMATED — same gold, so same darkened offset
      faceDownHatch: 'rgba(224,163,46,0.13)', // ESTIMATED
    },
    page: {
      background: '#221E2B', // CONFIRMED (selector swatch 2)
      ink: '#F4ECDC', // ESTIMATED — this skin's page is dark, so page ink inverts to light
      ring: '#0B0A10', // ESTIMATED — punched holes read darker than the page
      spine: '#2C2739', // ESTIMATED — page lightened, following Warm Binder's spine relationship
      spineBack: '#1B1826', // ESTIMATED
      texture: 'none',
    },
    cardstock: {
      base: '#F4ECDC', // CONFIRMED (selector swatch 3)
      mat: '#E6DCC7', // ESTIMATED — base darkened ~4%, matching Warm Binder's base→mat step
      border: '#16141C', // ESTIMATED — ink rule = shell.background, per Warm Binder
      inkRule: '#16141C', // ESTIMATED
      photoPlaceholder: '#C4BBAB', // ESTIMATED
    },
    foilRamp: {
      sweep: GOLD_FOIL_SWEEP, // ESTIMATED — shared "gold foil" label + identical accent
      sweepLocations: GOLD_FOIL_SWEEP_LOCATIONS,
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#B07A0E', // ESTIMATED
    },
  },
  scrapbookSun: {
    id: 'scrapbookSun',
    name: 'Scrapbook Sun',
    descriptor: 'LIGHT PAPER · HALFTONE', // CONFIRMED (selector copy)
    shell: {
      background: '#E8D9BE', // CONFIRMED (selector swatch 1)
      surface: '#DCCCB0', // CONFIRMED (selector swatch 2)
      border: 'rgba(58,46,30,0.15)', // ESTIMATED — dark ink at low opacity, since the shell is light
      textPrimary: '#3A2E1E', // ESTIMATED — dark ink, required for contrast on the light shell
      textSecondary: 'rgba(58,46,30,0.6)', // ESTIMATED
      textTertiary: 'rgba(58,46,30,0.42)', // ESTIMATED
      accent: '#D9411F', // CONFIRMED (selector swatch 4)
      highlight: '#F2571C', // ESTIMATED — accent brightened, mirroring #E0A32E → #F2A007
      onAccent: '#FFF8EC', // ESTIMATED — this accent is a saturated red; light text reads, dark doesn't
      accentShadow: '#A32F16', // ESTIMATED — accent darkened ~25%, matching gold→#A9761C
      faceDownHatch: 'rgba(217,65,31,0.13)', // ESTIMATED
    },
    page: {
      background: '#DCCCB0', // CONFIRMED (selector swatch 2)
      ink: '#3A2E1E', // ESTIMATED
      ring: '#3A2E1E', // ESTIMATED
      spine: '#CDBB9C', // ESTIMATED
      spineBack: '#BFAC8B', // ESTIMATED
      texture: 'halftone', // CONFIRMED (selector's "LIGHT PAPER · HALFTONE")
    },
    cardstock: {
      base: '#FFF8EC', // CONFIRMED (selector swatch 3)
      mat: '#F2E7D3', // ESTIMATED
      border: '#3A2E1E', // ESTIMATED — dark scrapbook-ink brown
      inkRule: '#3A2E1E', // ESTIMATED
      photoPlaceholder: '#D3C5AC', // ESTIMATED
    },
    foilRamp: {
      // ESTIMATED — the selector shows only a solid accent swatch for this skin, no gradient
      // anywhere in the source (unlike Foil Arcade's explicit one). Built as
      // transparent → white highlight → the confirmed accent red → transparent.
      sweep: ['transparent', 'rgba(255,255,255,0.8)', 'rgba(255,196,90,0.7)', 'rgba(217,65,31,0.55)', 'transparent'],
      sweepLocations: [0.18, 0.34, 0.48, 0.62, 0.8],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#B8351A', // ESTIMATED — accent darkened for legibility on light cardstock
    },
  },
  foilArcade: {
    id: 'foilArcade',
    name: 'Foil Arcade',
    descriptor: 'JEWEL DARK · CHROME', // CONFIRMED (selector copy)
    shell: {
      background: '#100B1F', // CONFIRMED (selector swatch 1)
      surface: '#1C1233', // CONFIRMED (selector swatch 2)
      border: 'rgba(241,236,255,0.1)', // ESTIMATED
      textPrimary: '#F1ECFF', // ESTIMATED — light lavender-white
      textSecondary: 'rgba(241,236,255,0.5)', // ESTIMATED
      textTertiary: 'rgba(241,236,255,0.35)', // ESTIMATED
      accent: '#52E6D8', // ESTIMATED — the first/most prominent stop of the confirmed foil gradient
      highlight: '#7BF2E6', // ESTIMATED — accent brightened
      onAccent: '#100B1F', // ESTIMATED — dark ink on a bright teal
      accentShadow: '#2F9E94', // ESTIMATED — accent darkened ~25%
      faceDownHatch: 'rgba(82,230,216,0.13)', // ESTIMATED
    },
    page: {
      background: '#1C1233', // CONFIRMED (selector swatch 2)
      ink: '#F1ECFF', // ESTIMATED — dark page, so page ink inverts to light
      ring: '#080513', // ESTIMATED
      spine: '#261844', // ESTIMATED
      spineBack: '#160E28', // ESTIMATED
      texture: 'none',
    },
    cardstock: {
      // ESTIMATED — the selector's cardstock swatch is itself a two-tone chrome gradient
      // (#D9D6E8 → #7A7591) that a flat token can't hold; using the lighter stop.
      base: '#D9D6E8',
      mat: '#C6C2D8', // ESTIMATED
      border: '#100B1F', // ESTIMATED — ink rule = shell.background, per Warm Binder
      inkRule: '#100B1F', // ESTIMATED
      photoPlaceholder: '#A7A3BB', // ESTIMATED
    },
    foilRamp: {
      // CONFIRMED — explicit gradient from the selector swatch:
      // linear-gradient(115deg, #52E6D8, #8B5CF6 45%, #FF4FB8)
      sweep: ['transparent', 'rgba(82,230,216,0.85)', 'rgba(139,92,246,0.8)', 'rgba(255,79,184,0.75)', 'transparent'],
      sweepLocations: [0.14, 0.32, 0.5, 0.68, 0.86],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#6D3FD4', // ESTIMATED — the gradient's mid stop, darkened for chrome cardstock
    },
  },

  // ---------------------------------------------------------------------------------------
  // NEW skins. Nothing below appears in the design source; each is an original token set
  // following Warm Binder's confirmed structure (ink rule = shell background on dark skins, a
  // plain dark ink on light ones; foil = transparent → white highlight → the skin's own hues →
  // transparent, at the same 112° sweep and 74°/0.22 grain the source fixes for every skin).
  // ---------------------------------------------------------------------------------------

  midnightInk: {
    id: 'midnightInk',
    name: 'Midnight Ink',
    descriptor: 'DEEP BLUE · SILVER FOIL',
    shell: {
      background: '#0B1020',
      surface: '#141B33',
      border: 'rgba(226,235,255,0.1)',
      textPrimary: '#E2EBFF',
      textSecondary: 'rgba(226,235,255,0.5)',
      textTertiary: 'rgba(226,235,255,0.35)',
      accent: '#7FA8FF',
      highlight: '#A8C4FF',
      onAccent: '#0B1020',
      accentShadow: '#4F72BE',
      faceDownHatch: 'rgba(127,168,255,0.13)',
    },
    page: {
      background: '#1B2340',
      ink: '#E2EBFF',
      ring: '#060912',
      spine: '#243060',
      spineBack: '#141B33',
      texture: 'none',
    },
    cardstock: {
      base: '#EEF2FC',
      mat: '#DDE4F4',
      border: '#0B1020',
      inkRule: '#0B1020',
      photoPlaceholder: '#B4BED4',
    },
    foilRamp: {
      sweep: [
        'transparent',
        'rgba(255,255,255,0.85)',
        'rgba(168,196,255,0.8)',
        'rgba(198,214,255,0.7)',
        'transparent',
      ],
      sweepLocations: [0.18, 0.34, 0.48, 0.64, 0.82],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#3E5EA8',
    },
  },

  sakuraPress: {
    id: 'sakuraPress',
    name: 'Sakura Press',
    descriptor: 'SOFT PAPER · ROSE FOIL',
    shell: {
      background: '#F6E9EC',
      surface: '#EBD7DC',
      border: 'rgba(74,42,52,0.15)',
      textPrimary: '#4A2A34',
      textSecondary: 'rgba(74,42,52,0.6)',
      textTertiary: 'rgba(74,42,52,0.42)',
      accent: '#D9557E',
      highlight: '#EE6F95',
      onAccent: '#FFF6F8',
      accentShadow: '#A63C5D',
      faceDownHatch: 'rgba(217,85,126,0.13)',
    },
    page: {
      background: '#EBD7DC',
      ink: '#4A2A34',
      ring: '#4A2A34',
      spine: '#DFC6CD',
      spineBack: '#CFB2BB',
      texture: 'none',
    },
    cardstock: {
      base: '#FFF6F8',
      mat: '#F7E5E9',
      border: '#4A2A34',
      inkRule: '#4A2A34',
      photoPlaceholder: '#D6BFC5',
    },
    foilRamp: {
      sweep: [
        'transparent',
        'rgba(255,255,255,0.85)',
        'rgba(255,183,206,0.8)',
        'rgba(217,85,126,0.55)',
        'transparent',
      ],
      sweepLocations: [0.18, 0.34, 0.48, 0.64, 0.82],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#B03A62',
    },
  },

  forestPress: {
    id: 'forestPress',
    name: 'Forest Press',
    descriptor: 'DEEP GREEN · BRASS FOIL',
    shell: {
      background: '#0E1A14',
      surface: '#17271F',
      border: 'rgba(226,240,230,0.1)',
      textPrimary: '#E2F0E6',
      textSecondary: 'rgba(226,240,230,0.5)',
      textTertiary: 'rgba(226,240,230,0.35)',
      accent: '#C7A24A',
      highlight: '#DFB95C',
      onAccent: '#0E1A14',
      accentShadow: '#957734',
      faceDownHatch: 'rgba(199,162,74,0.13)',
    },
    page: {
      background: '#DCE4D3',
      ink: '#0E1A14',
      ring: '#0E1A14',
      spine: '#1E3227',
      spineBack: '#17271F',
      texture: 'none',
    },
    cardstock: {
      base: '#F3F6EC',
      mat: '#E4EADA',
      border: '#0E1A14',
      inkRule: '#0E1A14',
      photoPlaceholder: '#BDC7B2',
    },
    foilRamp: {
      sweep: [
        'transparent',
        'rgba(255,255,255,0.85)',
        'rgba(223,185,92,0.8)',
        'rgba(140,214,168,0.7)',
        'transparent',
      ],
      sweepLocations: [0.18, 0.34, 0.5, 0.66, 0.82],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#8A6E22',
    },
  },

  monoPress: {
    id: 'monoPress',
    name: 'Mono Press',
    descriptor: 'GREYSCALE · ONE RED',
    shell: {
      background: '#121212',
      surface: '#1E1E1E',
      border: 'rgba(240,240,240,0.12)',
      textPrimary: '#F0F0F0',
      textSecondary: 'rgba(240,240,240,0.5)',
      textTertiary: 'rgba(240,240,240,0.35)',
      accent: '#E63946',
      highlight: '#F4646F',
      onAccent: '#FFFFFF',
      accentShadow: '#A32A33',
      faceDownHatch: 'rgba(240,240,240,0.1)',
    },
    page: {
      background: '#E8E8E8',
      ink: '#121212',
      ring: '#121212',
      spine: '#2A2A2A',
      spineBack: '#1E1E1E',
      texture: 'none',
    },
    cardstock: {
      base: '#FAFAFA',
      mat: '#EDEDED',
      border: '#121212',
      inkRule: '#121212',
      photoPlaceholder: '#C4C4C4',
    },
    foilRamp: {
      // Deliberately colourless apart from the accent — this skin's whole idea is that red is
      // the only hue in the app besides the vibe tags, which stay constant by design.
      sweep: [
        'transparent',
        'rgba(255,255,255,0.9)',
        'rgba(200,200,200,0.6)',
        'rgba(230,57,70,0.5)',
        'transparent',
      ],
      sweepLocations: [0.2, 0.36, 0.5, 0.66, 0.84],
      grainAngleDeg: 74,
      grainOpacity: 0.22,
      labelColor: '#B32833',
    },
  },
};

export const SKIN_ORDER: SkinId[] = [
  'warmBinder',
  'cardShop97',
  'scrapbookSun',
  'foilArcade',
  'midnightInk',
  'forestPress',
  'sakuraPress',
  'monoPress',
];

/**
 * The 4-swatch preview strip shown per skin in the selector (2i), in the source's order:
 * shell / page / cardstock / foil. Warm Binder's and Foil Arcade's foil chips are gradients
 * in the source, so each entry carries either a solid color or a 2–3 stop gradient.
 */
export const SKIN_SWATCHES: Record<SkinId, string[][]> = {
  // CONFIRMED — read straight from each selector row's inline styles.
  warmBinder: [['#17130F'], ['#E8D9BE'], ['#FAF3E4'], ['#E0A32E', '#F2A007']],
  cardShop97: [['#16141C'], ['#221E2B'], ['#F4ECDC'], ['#E0A32E']],
  scrapbookSun: [['#E8D9BE'], ['#DCCCB0'], ['#FFF8EC'], ['#D9411F']],
  foilArcade: [['#100B1F'], ['#1C1233'], ['#D9D6E8', '#7A7591'], ['#52E6D8', '#8B5CF6', '#FF4FB8']],
  // NEW skins — swatches mirror each token set's shell / page / cardstock / foil.
  midnightInk: [['#0B1020'], ['#1B2340'], ['#EEF2FC'], ['#7FA8FF', '#C6D6FF']],
  forestPress: [['#0E1A14'], ['#DCE4D3'], ['#F3F6EC'], ['#C7A24A', '#8CD6A8']],
  sakuraPress: [['#F6E9EC'], ['#EBD7DC'], ['#FFF6F8'], ['#D9557E', '#FFB7CE']],
  monoPress: [['#121212'], ['#E8E8E8'], ['#FAFAFA'], ['#E63946']],
};
