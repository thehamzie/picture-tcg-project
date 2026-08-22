import { File } from 'expo-file-system';
import {
  BlendMode,
  ImageFormat,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import { resolveOrientation, type ReportedSize } from './exif';
import {
  buildDevelopMatrix,
  isNeutral,
  totalGrain,
  totalVignette,
  type DevelopRecipe,
} from './filters';

// The image pipeline. This is what makes the camera's filters and develop controls *real*
// rather than a preview tint: the captured still is decoded, drawn through the recipe's colour
// matrix on the GPU, grain and vignette are composited on top, and the result is re-encoded.
//
// The whole recipe collapses into one colour matrix (see filters.ts), so a fifteen-megapixel
// photo costs a single texture upload and a single draw regardless of how many adjustments the
// user stacked.
//
// Lifetime note: a GPU-backed `SkImage` from `makeImageSnapshot()` can share its surface's
// texture, so every encode and every downstream draw happens while the surface that produced
// it is still alive. That is why this file does its work in one long function rather than
// returning images across function boundaries.

/**
 * Guard against a photo larger than the GPU will accept as a texture. 4096 is the smallest max
 * texture size still in circulation; a 12MP phone photo (4032x3024) sits just under it, so in
 * practice this almost never triggers — it exists so an unusually large import degrades to a
 * resize instead of failing to render.
 */
const MAX_EDGE = 4096;

/** JPEG quality for the stored card photo. */
const PHOTO_QUALITY = 92;

/** Long edge of the generated thumbnail, in pixels. Covers a 3-column grid slot at 3x. */
export const THUMBNAIL_EDGE = 360;
const THUMBNAIL_QUALITY = 80;

/**
 * Long edge of the copy the develop screen edits. Comfortably above a phone screen's pixel
 * width, so the preview is sharp, and far below a 12MP capture, so redrawing it on every slider
 * frame stays cheap.
 */
const EDITABLE_EDGE = 1200;

export type DevelopedPhoto = {
  photo: Uint8Array;
  thumbnail: Uint8Array;
};

/**
 * Decodes, develops, and re-encodes a captured photo, plus a matching thumbnail.
 *
 * Orientation is read out of the file's own bytes rather than taken from the capture API. Skia
 * decodes raw pixels and applies no orientation; React Native's `<Image>` applies the file's
 * tag. Reading the same tag `<Image>` reads is what guarantees a developed photo comes out
 * facing the way the app was already showing it — see `exif.ts` for why the value the camera
 * *reports* is a different number and cannot be trusted for this.
 */
export async function developPhoto(
  sourceUri: string,
  recipe: DevelopRecipe,
  reported?: ReportedSize | null
): Promise<DevelopedPhoto> {
  const bytes = await readBytes(sourceUri);
  const source = decodeBytes(bytes);
  const exifOrientation = resolveOrientation(
    bytes,
    { width: source.width(), height: source.height() },
    reported
  );
  try {
    const sourceWidth = source.width();
    const sourceHeight = source.height();

    // Orientations 5-8 put the image on its side, so the output is the transpose of the input.
    const swapsAxes = exifOrientation >= 5 && exifOrientation <= 8;
    const uprightWidth = swapsAxes ? sourceHeight : sourceWidth;
    const uprightHeight = swapsAxes ? sourceWidth : sourceHeight;

    const scale = Math.min(1, MAX_EDGE / Math.max(uprightWidth, uprightHeight));
    const width = Math.max(1, Math.round(uprightWidth * scale));
    const height = Math.max(1, Math.round(uprightHeight * scale));

    const surface = makeSurface(width, height);
    try {
      const canvas = surface.getCanvas();

      canvas.save();
      canvas.scale(scale, scale);
      applyExifTransform(canvas, exifOrientation, uprightWidth, uprightHeight);

      const paint = Skia.Paint();
      if (!isNeutral(recipe)) {
        paint.setColorFilter(Skia.ColorFilter.MakeMatrix(buildDevelopMatrix(recipe)));
      }
      canvas.drawImage(source, 0, 0, paint);
      canvas.restore();

      // Grain and vignette sit in unrotated output space — grain has no orientation to
      // respect, and a vignette follows the final frame rather than the sensor's.
      const vignette = totalVignette(recipe);
      if (vignette > 0) drawVignette(canvas, width, height, vignette);

      const grain = totalGrain(recipe);
      if (grain > 0) drawGrain(canvas, width, height, grain);

      const developed = surface.makeImageSnapshot();
      try {
        return {
          photo: developed.encodeToBytes(ImageFormat.JPEG, PHOTO_QUALITY),
          thumbnail: encodeThumbnail(developed),
        };
      } finally {
        developed.dispose?.();
      }
    } finally {
      surface.dispose?.();
    }
  } finally {
    source.dispose?.();
  }
}

/**
 * An upright, downscaled copy of a capture, held in memory for interactive editing.
 *
 * The develop screen redraws on every slider movement, so it cannot re-run the full pipeline
 * each time — a 12MP decode per frame would be unusable. Instead this runs once: it applies the
 * orientation and the downscale (the two things that never change while editing) and hands back
 * an image the screen can draw repeatedly with a colour filter, which is a single GPU draw.
 *
 * `makeNonTextureImage` copies the result into CPU memory so it outlives the surface that made
 * it. Without that the caller would be holding a GPU texture belonging to a disposed surface.
 *
 * Dispose the returned image when the screen unmounts.
 */
export async function prepareEditableImage(
  sourceUri: string,
  reported?: ReportedSize | null,
  maxEdge = EDITABLE_EDGE
): Promise<SkImage> {
  const bytes = await readBytes(sourceUri);
  const source = decodeBytes(bytes);
  const exifOrientation = resolveOrientation(
    bytes,
    { width: source.width(), height: source.height() },
    reported
  );
  try {
    const swapsAxes = exifOrientation >= 5 && exifOrientation <= 8;
    const uprightWidth = swapsAxes ? source.height() : source.width();
    const uprightHeight = swapsAxes ? source.width() : source.height();

    const scale = Math.min(1, maxEdge / Math.max(uprightWidth, uprightHeight));
    const width = Math.max(1, Math.round(uprightWidth * scale));
    const height = Math.max(1, Math.round(uprightHeight * scale));

    const surface = makeSurface(width, height);
    try {
      const canvas = surface.getCanvas();
      canvas.scale(scale, scale);
      applyExifTransform(canvas, exifOrientation, uprightWidth, uprightHeight);
      canvas.drawImage(source, 0, 0, Skia.Paint());

      const snapshot = surface.makeImageSnapshot();
      try {
        return snapshot.makeNonTextureImage();
      } finally {
        snapshot.dispose?.();
      }
    } finally {
      surface.dispose?.();
    }
  } finally {
    source.dispose?.();
  }
}

/**
 * Re-encodes an existing photo as a thumbnail, without developing it. Used to backfill
 * thumbnails for cards captured before thumbnails existed — those photos are already stored in
 * their final form, so re-applying a recipe to them would be wrong.
 */
export async function makeThumbnail(sourceUri: string): Promise<Uint8Array> {
  const source = decodeBytes(await readBytes(sourceUri));
  try {
    return encodeThumbnail(source);
  } finally {
    source.dispose?.();
  }
}

/**
 * One read of the file, used for both the orientation tag and the decode. Reading the bytes
 * ourselves rather than handing Skia a URI is what makes the tag available at all — `SkData`
 * offers no way back to the encoded bytes once it holds them.
 */
async function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri.startsWith('file://') ? uri : `file://${uri}`).bytes();
}

function decodeBytes(bytes: Uint8Array): SkImage {
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) throw new Error('The photo could not be decoded.');
  return image;
}

/** GPU where available, CPU raster otherwise (simulators and some Android devices). */
function makeSurface(width: number, height: number) {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error('The photo could not be prepared for editing.');
  return surface;
}

/**
 * Puts the canvas into the image's own pixel space such that drawing the decoded image at
 * (0,0) lands it upright in an `outWidth` x `outHeight` frame.
 *
 * The EXIF tags mean, in order: 1 upright, 2 mirrored, 3 rotated 180, 4 flipped, 5 transposed,
 * 6 rotated 90 CW, 7 anti-transposed, 8 rotated 90 CCW. Skia post-concatenates each call, so
 * the *last* call listed is the first transform applied to a point.
 */
function applyExifTransform(
  canvas: SkCanvas,
  orientation: number,
  outWidth: number,
  outHeight: number
) {
  switch (orientation) {
    case 2:
      canvas.translate(outWidth, 0);
      canvas.scale(-1, 1);
      break;
    case 3:
      canvas.translate(outWidth, outHeight);
      canvas.rotate(180, 0, 0);
      break;
    case 4:
      canvas.translate(0, outHeight);
      canvas.scale(1, -1);
      break;
    case 5:
      canvas.scale(-1, 1);
      canvas.rotate(90, 0, 0);
      break;
    case 6:
      canvas.translate(outWidth, 0);
      canvas.rotate(90, 0, 0);
      break;
    case 7:
      canvas.translate(outWidth, outHeight);
      canvas.scale(1, -1);
      canvas.rotate(90, 0, 0);
      break;
    case 8:
      canvas.translate(0, outHeight);
      canvas.rotate(-90, 0, 0);
      break;
    default:
      break;
  }
}

// Film grain, defined once so the develop screen's live preview and the bake cannot drift.
//
// Perlin noise is inherently coloured and has noisy alpha of its own, so the colour matrix
// flattens it to luminance and pins its alpha to a constant strength. The strength lives *in
// the matrix*, not in a paint opacity — that matters, because it means an ignored blend mode
// degrades to a faint grey veil rather than to opaque static across the whole picture.
//
// Frequency is quoted per pixel, so the grain stays the same physical size whatever the photo's
// resolution — otherwise a 12MP capture would look smooth and a small crop sandy.

/** Strongest the grain gets, at amount = 1. Low on purpose: this is texture, not noise. */
const GRAIN_CEILING = 0.3;

export const GRAIN_FREQUENCY = 0.55;
export const GRAIN_OCTAVES = 2;

export function grainColorMatrix(amount: number): number[] {
  const strength = Math.min(GRAIN_CEILING, Math.max(0, amount) * GRAIN_CEILING);
  return [
    0.33, 0.33, 0.33, 0, 0,
    0.33, 0.33, 0.33, 0, 0,
    0.33, 0.33, 0.33, 0, 0,
    0, 0, 0, 0, strength,
  ];
}

function drawGrain(canvas: SkCanvas, width: number, height: number, amount: number) {
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeFractalNoise(GRAIN_FREQUENCY, GRAIN_FREQUENCY, GRAIN_OCTAVES, 0, 0, 0)
  );
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(grainColorMatrix(amount)));
  paint.setBlendMode(BlendMode.SoftLight);
  canvas.drawRect({ x: 0, y: 0, width, height }, paint);
}

function drawVignette(canvas: SkCanvas, width: number, height: number, amount: number) {
  // The gradient is circular; a local matrix stretches it to the frame so a tall photo gets an
  // oval falloff rather than a dark band across the middle of a circle.
  const matrix = Skia.Matrix();
  matrix.translate(width / 2, height / 2);
  matrix.scale(1, height / width);
  matrix.translate(-width / 2, -height / 2);

  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: width / 2, y: height / 2 },
      width * 0.72,
      [Skia.Color('rgba(0,0,0,0)'), Skia.Color(`rgba(0,0,0,${(amount * 0.55).toFixed(3)})`)],
      [0.45, 1],
      TileMode.Clamp,
      matrix
    )
  );
  canvas.drawRect({ x: 0, y: 0, width, height }, paint);
}

/** Draws `image` down to thumbnail size in its own surface and returns the encoded JPEG. */
function encodeThumbnail(image: SkImage): Uint8Array {
  const sourceWidth = image.width();
  const sourceHeight = image.height();
  const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const surface = makeSurface(width, height);
  try {
    surface
      .getCanvas()
      .drawImageRect(
        image,
        { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
        { x: 0, y: 0, width, height },
        Skia.Paint()
      );
    const snapshot = surface.makeImageSnapshot();
    try {
      return snapshot.encodeToBytes(ImageFormat.JPEG, THUMBNAIL_QUALITY);
    } finally {
      snapshot.dispose?.();
    }
  } finally {
    surface.dispose?.();
  }
}
