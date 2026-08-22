// Reading the orientation tag out of a JPEG's own bytes.
//
// This exists because of a trap that cost a rotated photo. There are *two* different
// orientation values in play for a capture, and they are not the same number:
//
//   1. The tag in the file. Every decoder that honours orientation reads this — including
//      React Native's `<Image>`, which is how the photo appears everywhere in the app.
//   2. `photo.exif.Orientation`, as reported by expo-camera. Its iOS implementation computes
//      this from the `UIImage`'s orientation and writes it into the EXIF *sub-dictionary*
//      (`ExpoCameraUtils.data`), which is not where the canonical orientation tag lives — that
//      is TIFF/IFD0 tag 0x0112. So the reported value is derived independently of the file's
//      own tag and can disagree with it.
//
// Skia decodes raw pixels and applies neither. So the develop pass has to apply exactly what
// `<Image>` would apply, or the photo changes orientation the moment it is developed. Reading
// the file settles it: whatever is in these bytes is what the rest of the app is honouring.
//
// A photo whose tag can't be found is treated as upright, which is correct for the common case
// of a JPEG that was already normalised (and for PNGs, which carry no orientation at all).

const UPRIGHT = 1;

/** Dimensions as the source reported them — `photo.width/height`, `asset.width/height`. */
export type ReportedSize = { width: number; height: number };

/**
 * How far to turn a decoded image, decided by measurement rather than by trusting a tag.
 *
 * The tag alone is not reliable here, and the reason is worth keeping. expo-camera's iOS path
 * writes the JPEG through `UIImage.jpegData()`, which *bakes* the orientation into the pixels —
 * and then stamps the pre-baked orientation into the file's EXIF anyway
 * (`ExpoCameraUtils.data`). The result is a file whose pixels are already upright and whose tag
 * says to turn it a quarter turn. Applying that tag is what rotated every portrait by 90°.
 *
 * So the tag is treated as advice about *direction* only. What decides whether to rotate at all
 * is whether the decoded pixel dimensions are transposed relative to the dimensions the capture
 * API reported — two independent facts about the same file, rather than one claim about it:
 *
 *   dimensions agree      the pixels are already the right way round. Do nothing, whatever the
 *                         tag says. This is the expo-camera case above.
 *   dimensions transposed the pixels really are on their side, so turn them; the tag says which
 *                         way, and 6 (a quarter turn clockwise) is the overwhelmingly common
 *                         answer when it doesn't.
 *
 * With no reported size to compare against, there is nothing to measure and the tag is all
 * there is.
 */
export function resolveOrientation(
  bytes: Uint8Array,
  decoded: ReportedSize,
  reported?: ReportedSize | null
): number {
  const tag = readJpegOrientation(bytes);

  if (!reported || reported.width <= 0 || reported.height <= 0) return tag;
  if (decoded.width <= 0 || decoded.height <= 0) return tag;

  // A square image is transposed and not transposed at once, so there is nothing to learn.
  if (decoded.width === decoded.height || reported.width === reported.height) return UPRIGHT;

  const decodedIsLandscape = decoded.width > decoded.height;
  const reportedIsLandscape = reported.width > reported.height;
  if (decodedIsLandscape === reportedIsLandscape) return UPRIGHT;

  return tag >= 5 && tag <= 8 ? tag : 6;
}

const SOI = 0xd8;
const APP1 = 0xe1;
const SOS = 0xda;
const EOI = 0xd9;
const ORIENTATION_TAG = 0x0112;

/**
 * The EXIF orientation of a JPEG, 1..8, or 1 when there isn't one.
 *
 * Only the first few hundred bytes are usually touched: the scan stops at the start of image
 * data, since orientation always precedes it.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== SOI) return UPRIGHT;

  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Fill bytes are legal between segments; anything else means the stream is not laid out
      // the way this parser understands, so stop rather than guess.
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === SOS || marker === EOI) return UPRIGHT;

    const segmentLength = readUint16(bytes, offset + 2, false);
    if (segmentLength < 2) return UPRIGHT;

    if (marker === APP1 && isExifHeader(bytes, offset + 4)) {
      const found = readOrientationFromTiff(bytes, offset + 10, offset + 2 + segmentLength);
      if (found !== null) return found;
    }

    offset += 2 + segmentLength;
  }

  return UPRIGHT;
}

/** The APP1 payload begins with the ASCII string "Exif" and two zero bytes. */
function isExifHeader(bytes: Uint8Array, at: number): boolean {
  return (
    at + 6 <= bytes.length &&
    bytes[at] === 0x45 &&
    bytes[at + 1] === 0x78 &&
    bytes[at + 2] === 0x69 &&
    bytes[at + 3] === 0x66 &&
    bytes[at + 4] === 0x00 &&
    bytes[at + 5] === 0x00
  );
}

/**
 * Walks IFD0 looking for tag 0x0112.
 *
 * `tiffStart` is the beginning of the TIFF header, which is also the origin every offset inside
 * the block is measured from — including the offset to IFD0 itself.
 */
function readOrientationFromTiff(bytes: Uint8Array, tiffStart: number, limit: number): number | null {
  if (tiffStart + 8 > limit || tiffStart + 8 > bytes.length) return null;

  // "II" little-endian, "MM" big-endian. Both occur in the wild.
  const byteOrder = readUint16(bytes, tiffStart, false);
  let littleEndian: boolean;
  if (byteOrder === 0x4949) littleEndian = true;
  else if (byteOrder === 0x4d4d) littleEndian = false;
  else return null;

  if (readUint16(bytes, tiffStart + 2, littleEndian) !== 0x002a) return null;

  const ifdOffset = readUint32(bytes, tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > limit || ifdStart + 2 > bytes.length) return null;

  const entryCount = readUint16(bytes, ifdStart, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (entry + 12 > limit || entry + 12 > bytes.length) return null;

    if (readUint16(bytes, entry, littleEndian) === ORIENTATION_TAG) {
      // A SHORT sits in the first two bytes of the entry's four-byte value field, whichever
      // way round the file is.
      const value = readUint16(bytes, entry + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : null;
    }
  }

  return null;
}

function readUint16(bytes: Uint8Array, at: number, littleEndian: boolean): number {
  return littleEndian ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];
}

function readUint32(bytes: Uint8Array, at: number, littleEndian: boolean): number {
  return littleEndian
    ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
    : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}
