// Typography — extracted verbatim from design-reference/"Daily Pull - Screens (standalone).html".
//
// The mockup uses exactly three families:
//   'Archivo Black'  → every display header, card title, and primary button label
//   'Archivo'        → body copy (600 for emphasis, 400 for muted secondary lines)
//   'DM Mono'        → dates, rarity, card numbers, and all the small tracked-out labels
//
// All three are bundled via @expo-google-fonts (see App.tsx's useFonts call) rather than
// loaded over the network, so there's no runtime fetch and no FOUT.

import { Dimensions, StyleSheet } from 'react-native';

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  body: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
  bodySemi: 'Archivo_600SemiBold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

/** The font map passed to `useFonts` — kept next to the family names so they can't drift. */
export const FONT_ASSETS = {
  ArchivoBlack_400Regular: require('@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf'),
  Archivo_400Regular: require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
  Archivo_500Medium: require('@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf'),
  Archivo_600SemiBold: require('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
  DMMono_400Regular: require('@expo-google-fonts/dm-mono/400Regular/DMMono_400Regular.ttf'),
  DMMono_500Medium: require('@expo-google-fonts/dm-mono/500Medium/DMMono_500Medium.ttf'),
};

// The mockup's phone frame has a 344pt-wide viewport. Every px value in this file and in the
// screens is copied straight from that frame, so on a wider real device they'd all render
// proportionally small. Scaling by the viewport ratio (clamped, so tablets don't balloon)
// keeps the mockup's proportions rather than its literal pixel sizes.
const MOCKUP_VIEWPORT_WIDTH = 344;
const rawScale = Dimensions.get('window').width / MOCKUP_VIEWPORT_WIDTH;
export const SCALE = Math.min(1.18, Math.max(0.9, rawScale));

/** Scales a mockup pixel value to this device. Round to a half-pixel to avoid blurry text. */
export function s(value: number): number {
  return Math.round(value * SCALE * 2) / 2;
}

/**
 * Mono label style. `lsEm` is the CSS `letter-spacing` in em from the mockup — RN takes
 * absolute points, so it's multiplied through here rather than at each call site.
 */
export function mono(fontSize: number, lsEm = 0, medium = true) {
  return monoRaw(s(fontSize), lsEm, medium);
}

/** Archivo Black display style. The mockup always pairs it with `text-transform: uppercase`. */
export function display(fontSize: number, lineHeightRatio?: number) {
  return displayRaw(s(fontSize), lineHeightRatio);
}

/** Archivo body style. `weight` picks between the 400/500/600 cuts the mockup uses. */
export function body(fontSize: number, weight: 400 | 500 | 600 = 400, lineHeightRatio?: number) {
  return bodyRaw(s(fontSize), weight, lineHeightRatio);
}

// `…Raw` variants skip the device scale. Use them where the caller already derived its own
// size factor — CardFace scales every dimension by `u = width / 250`, so running `s()` again
// inside it would compound the two.

export function monoRaw(fontSize: number, lsEm = 0, medium = true) {
  return {
    fontFamily: medium ? fonts.monoMedium : fonts.mono,
    fontSize,
    letterSpacing: fontSize * lsEm,
  } as const;
}

export function displayRaw(fontSize: number, lineHeightRatio?: number) {
  return {
    fontFamily: fonts.display,
    fontSize,
    textTransform: 'uppercase',
    ...(lineHeightRatio ? { lineHeight: fontSize * lineHeightRatio } : null),
  } as const;
}

export function bodyRaw(fontSize: number, weight: 400 | 500 | 600 = 400, lineHeightRatio?: number) {
  return {
    fontFamily: weight === 600 ? fonts.bodySemi : weight === 500 ? fonts.bodyMedium : fonts.body,
    fontSize,
    ...(lineHeightRatio ? { lineHeight: fontSize * lineHeightRatio } : null),
  } as const;
}

/** Hairline used for the tab-bar rule and other 1px dividers in the mockup. */
export const hairline = StyleSheet.hairlineWidth;
