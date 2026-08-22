import { Directory, File, Paths } from 'expo-file-system';

import { developPhoto, makeThumbnail } from '../camera/develop';
import type { ReportedSize } from '../camera/exif';
import type { DevelopRecipe } from '../camera/filters';

const CARDS_DIR_NAME = 'cards';

function getCardsDirectory(): Directory {
  const dir = new Directory(Paths.document, CARDS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export type StoredPhoto = {
  photoUri: string;
  thumbUri: string;
};

function photoFile(date: string): File {
  return new File(getCardsDirectory(), `${date}.jpg`);
}

function thumbFile(date: string): File {
  return new File(getCardsDirectory(), `${date}_thumb.jpg`);
}

function writeFile(file: File, bytes: Uint8Array): string {
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

/**
 * Develops a captured photo and writes it — plus its thumbnail — into permanent local storage,
 * keyed by date.
 *
 * The filter is baked in here and the original capture is not kept: that was a deliberate
 * call, and it means the stored photo *is* the filtered photo. Anywhere the app offers "the
 * photo on its own" it means this file without the app's frame and captions around it, not an
 * unfiltered negative — there isn't one.
 */
export async function saveCardPhoto(
  sourceUri: string,
  date: string,
  recipe: DevelopRecipe,
  reported?: ReportedSize | null
): Promise<StoredPhoto> {
  const developed = await developPhoto(sourceUri, recipe, reported);
  return {
    photoUri: writeFile(photoFile(date), developed.photo),
    thumbUri: writeFile(thumbFile(date), developed.thumbnail),
  };
}

/**
 * Writes raw bytes straight through, with no develop pass. Used by restore, where the photo
 * arriving from a backup has already been developed once and must not be processed again.
 */
export async function writeRestoredPhoto(date: string, bytes: Uint8Array): Promise<StoredPhoto> {
  const photoUri = writeFile(photoFile(date), bytes);
  let thumbUri = photoUri;
  try {
    thumbUri = writeFile(thumbFile(date), await makeThumbnail(photoUri));
  } catch (error) {
    // A missing thumbnail is a performance problem, not a data problem — the grid falls back
    // to the full photo. Never fail a restore over one.
    console.warn('[photoStorage] could not build thumbnail on restore', date, error);
  }
  return { photoUri, thumbUri };
}

/** Builds the thumbnail for a card that predates thumbnails. Returns null if it can't. */
export async function backfillThumbnail(photoUri: string, date: string): Promise<string | null> {
  try {
    return writeFile(thumbFile(date), await makeThumbnail(photoUri));
  } catch (error) {
    console.warn('[photoStorage] could not backfill thumbnail', date, error);
    return null;
  }
}

/**
 * Deletes a card's stored files. Missing or already-deleted files are not an error — the
 * caller is removing the row either way, and refusing to finish a delete because the file was
 * already gone would leave the user stuck with a card they asked to remove.
 */
export function deleteCardPhoto(photoUri: string, thumbUri?: string | null): void {
  // A Set because a card with no thumbnail stores the photo's own URI as its thumb.
  const targets = new Set([photoUri, thumbUri].filter((uri): uri is string => Boolean(uri)));
  for (const uri of targets) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('[photoStorage] could not delete file', uri, error);
    }
  }
}
