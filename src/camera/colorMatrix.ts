// 4x5 colour matrices, the form Skia's `ColorFilter.MakeMatrix` takes.
//
// Row-major, 20 floats. Each row is `[r, g, b, a, offset]` and produces one output channel:
//
//     R' = m[0]*R + m[1]*G + m[2]*B + m[3]*A + m[4]
//
// Channels and the offset column are all in 0..1 (this is Skia's float form, not the 0..255
// one Android's ColorMatrix uses — an offset of `0.1` is a tenth of full scale, not 1/2550).
//
// Everything here is a pure function of numbers so a whole develop recipe collapses into one
// matrix, which means one GPU pass at capture time regardless of how many adjustments the
// user stacked.

export type ColorMatrix = number[];

export const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Combines two matrices into one. `multiply(a, b)` applies **b first, then a** — the same
 * order as function composition, so `compose()` below reads left-to-right as "first this,
 * then that".
 *
 * Both operands are treated as 5x5 with an implicit bottom row of `[0,0,0,0,1]`, which is what
 * makes the offset column compose correctly rather than just being added twice.
 */
export function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }
      out[row * 5 + col] = sum;
    }
    let offset = a[row * 5 + 4];
    for (let k = 0; k < 4; k += 1) {
      offset += a[row * 5 + k] * b[k * 5 + 4];
    }
    out[row * 5 + 4] = offset;
  }
  return out;
}

/** Applies each matrix in order: `compose(x, y)` runs x, then y. */
export function compose(...matrices: (ColorMatrix | null | undefined)[]): ColorMatrix {
  return matrices.reduce<ColorMatrix>(
    (accumulated, next) => (next ? multiply(next, accumulated) : accumulated),
    IDENTITY
  );
}

/** Per-channel gain and offset. The building block most of the presets are written in. */
export function channels(
  gain: [number, number, number],
  offset: [number, number, number] = [0, 0, 0]
): ColorMatrix {
  return [
    gain[0], 0, 0, 0, offset[0],
    0, gain[1], 0, 0, offset[1],
    0, 0, gain[2], 0, offset[2],
    0, 0, 0, 1, 0,
  ];
}

/**
 * Photographic stops. `ev` of +1 doubles the light, -1 halves it — the same scale the camera's
 * exposure readout shows, rather than an arbitrary 0..1 brightness.
 */
export function exposure(ev: number): ColorMatrix {
  const gain = Math.pow(2, ev);
  return channels([gain, gain, gain]);
}

/** `amount` 0 leaves the image alone; -1 is flat, +1 is roughly double contrast. */
export function contrast(amount: number): ColorMatrix {
  const factor = 1 + amount;
  const pivot = (1 - factor) * 0.5; // rotate around mid-grey, not around black
  return channels([factor, factor, factor], [pivot, pivot, pivot]);
}

/** `amount` 0 is greyscale, 1 is untouched, 2 is doubled. Luminance-preserving (Rec. 709). */
export function saturation(amount: number): ColorMatrix {
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  const inverse = 1 - amount;
  return [
    lr * inverse + amount, lg * inverse, lb * inverse, 0, 0,
    lr * inverse, lg * inverse + amount, lb * inverse, 0, 0,
    lr * inverse, lg * inverse, lb * inverse + amount, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** `amount` -1 (cool/blue) .. +1 (warm/amber). Leaves green almost alone, as a real CTO/CTB does. */
export function temperature(amount: number): ColorMatrix {
  return channels([1 + 0.2 * amount, 1 + 0.03 * amount, 1 - 0.2 * amount]);
}

/**
 * The faded-film look: compress the range and lift the blacks off zero, so the darkest part of
 * the picture is a soft grey rather than true black. `amount` 0..1.
 */
export function fade(amount: number, tint: [number, number, number] = [1, 1, 1]): ColorMatrix {
  const scale = 1 - 0.34 * amount;
  const lift = 0.17 * amount;
  return channels(
    [scale, scale, scale],
    [lift * tint[0], lift * tint[1], lift * tint[2]]
  );
}

/** Full monochrome using Rec. 709 luminance — `saturation(0)` by another name, kept for clarity. */
export function grayscale(): ColorMatrix {
  return saturation(0);
}

/**
 * Pushes the image toward a single hue by however much `strength` says, keeping its luminance.
 * Used for sepia and the tinted monochromes.
 */
export function duotone(color: [number, number, number], strength: number): ColorMatrix {
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  const keep = 1 - strength;
  return [
    lr * color[0] * strength + keep, lg * color[0] * strength, lb * color[0] * strength, 0, 0,
    lr * color[1] * strength, lg * color[1] * strength + keep, lb * color[1] * strength, 0, 0,
    lr * color[2] * strength, lg * color[2] * strength, lb * color[2] * strength + keep, 0, 0,
    0, 0, 0, 1, 0,
  ];
}
