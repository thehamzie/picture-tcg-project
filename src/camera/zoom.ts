// Turning expo-camera's abstract 0..1 `zoom` prop into something that means "1×" or "2×".
//
// The mapping is not linear. expo-camera's iOS implementation is, verbatim:
//
//     device.videoZoomFactor = 1.0 * pow(device.activeFormat.videoMaxZoomFactor / 1.0, zoom)
//
// so the magnification is `maxFactor ^ zoom`, and the inverse is `log(factor) / log(maxFactor)`.
// That shape is why a naive linear pinch feels wrong at one end of the range and useless at the
// other, and why a "2×" button cannot simply set `zoom = 0.5`.
//
// The catch: **`videoMaxZoomFactor` is not exposed to JavaScript.** There is no getter on
// `CameraView`, so the exact device maximum is unknowable from here and `ASSUMED_MAX_FACTOR`
// below is a calibration constant, not a measurement. Everything derived from it — the 2× stop
// and the pinch sensitivity — is therefore approximate, and this is the single place to adjust
// if it lands wide of the mark on a real device.
//
// 0.5× is a different problem and an honest one: no amount of zoom can make a lens wider than
// it is. Going below 1× requires physically switching to the ultra-wide lens, which is why
// `zoomForFactor(0.5)` clamps to 0 and the 0.5× stop is lens-based instead.

/**
 * Assumed `videoMaxZoomFactor`. iPhone photo formats typically report something in the low
 * hundreds; this sits in that range deliberately, since overshooting the guess makes the 2×
 * stop too tight rather than too loose.
 */
const ASSUMED_MAX_FACTOR = 120;

/** Precomputed on the JS thread — the pinch worklet captures this number, never the `Math.log` call site. */
export const LN_MAX_FACTOR = Math.log(ASSUMED_MAX_FACTOR);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The 0..1 `zoom` prop that lands closest to a given magnification. */
export function zoomForFactor(factor: number): number {
  return clamp01(Math.log(factor) / LN_MAX_FACTOR);
}

/** The magnification a given 0..1 `zoom` prop produces. */
export function factorForZoom(zoom: number): number {
  return Math.pow(ASSUMED_MAX_FACTOR, clamp01(zoom));
}

/** e.g. "1×", "1.8×", "12×" — no trailing ".0", and no false precision once it's well past 10. */
export function formatFactor(factor: number): string {
  if (factor >= 10) return `${Math.round(factor)}×`;
  const rounded = Math.round(factor * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}×`;
}

export type ZoomStop = {
  factor: number;
  label: string;
  /** True when the stop can only be reached by changing lens, not by zooming. */
  needsUltraWide: boolean;
};

export const ZOOM_STOPS: ZoomStop[] = [
  { factor: 0.5, label: '0.5', needsUltraWide: true },
  { factor: 1, label: '1', needsUltraWide: false },
  { factor: 2, label: '2', needsUltraWide: false },
];

/**
 * Picks the ultra-wide and the standard lens out of what the camera reports.
 *
 * `getAvailableLenses` returns each device's `localizedName` — "Back Ultra Wide Camera", "Back
 * Camera", and so on. Those are *localized*, so matching on English words is fragile by
 * construction. It fails safe: an unmatched ultra-wide simply means the 0.5× stop is hidden,
 * which is also the correct outcome on a phone that genuinely has no ultra-wide lens.
 */
export function classifyLenses(lenses: string[]): { ultraWide: string | null; standard: string | null } {
  const ultraWide = lenses.find((name) => /ultra/i.test(name)) ?? null;
  const standard = lenses.find((name) => !/ultra|tele|depth|lidar|truedepth/i.test(name)) ?? null;
  return { ultraWide, standard };
}
