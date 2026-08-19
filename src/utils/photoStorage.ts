import { Directory, File, Paths } from 'expo-file-system';

const CARDS_DIR_NAME = 'cards';

function getCardsDirectory(): Directory {
  const dir = new Directory(Paths.document, CARDS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** Copies a captured/imported photo into permanent local storage, keyed by date. Returns the new file's URI. */
export function saveCardPhoto(sourceUri: string, date: string): string {
  const destination = new File(getCardsDirectory(), `${date}.jpg`);
  if (destination.exists) {
    destination.delete();
  }
  const source = new File(sourceUri);
  source.copy(destination);
  return destination.uri;
}

/**
 * Deletes a card's stored photo. Missing or already-deleted files are not an error — the
 * caller is removing the row either way, and refusing to finish a delete because the file was
 * already gone would leave the user stuck with a card they asked to remove.
 */
export function deleteCardPhoto(photoUri: string): void {
  try {
    const file = new File(photoUri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[photoStorage] could not delete photo', photoUri, error);
  }
}
