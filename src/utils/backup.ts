import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getExistingCardDates, insertCard } from '../db/cardsRepository';
import type { VibeType } from '../theme/theme';
import type { Card } from '../types/card';
import { writeRestoredPhoto } from './photoStorage';

// Getting a collection out of the app — and back into it.
//
// Why this matters more than it looks: every photo lives in the app's own document directory
// and every record lives in a local SQLite file. Delete the app, lose the phone, or move to a
// device without a full encrypted backup, and the whole collection is gone with no warning and
// no recovery. For something meant to be kept for years, that is the one failure that actually
// hurts.
//
// There are three operations, and they do different amounts of good:
//
//   `saveAllPhotosToLibrary`   copies the photographs into the OS photo library, which is
//                              already covered by iCloud / Google Photos. Protects the pictures
//                              but not the titles, tags, rarity or dates.
//   `writeCollectionExport`    the records alone, as readable JSON. For reading elsewhere, not
//                              for restoring.
//   `writeBackupArchive` /     a complete backup: records *and* photos in one file, and the
//   `restoreFromArchive`       matching import. This is the only pair that can actually put a
//                              collection back.

const EXPORT_FORMAT_VERSION = 1;
const ALBUM_NAME = 'Daily Pull';

export type BackupProgress = { done: number; total: number };

export type CollectionExport = {
  format: 'daily-pull-collection';
  version: number;
  exportedAt: string;
  cardCount: number;
  cards: {
    cardNumber: number;
    date: string;
    title: string | null;
    vibe: string | null;
    isHolo: boolean;
    createdAt: string;
    filterId: string | null;
    /** Basename of the stored photo, so a reader can pair records with files. */
    photoFilename: string;
  }[];
};

export function buildCollectionExport(cards: Card[]): CollectionExport {
  return {
    format: 'daily-pull-collection',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    cardCount: cards.length,
    cards: [...cards]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((card) => ({
        cardNumber: card.id,
        date: card.date,
        title: card.title ?? null,
        vibe: card.vibeType ?? null,
        isHolo: card.isHolo,
        createdAt: card.createdAt,
        filterId: card.filterId ?? null,
        photoFilename: card.photoUri.split('/').pop() ?? `${card.date}.jpg`,
      })),
  };
}

/**
 * Writes the records to a cache file and returns its URI, ready to hand to the share sheet.
 * Cache rather than documents: this is a transfer artefact, not app data, and the OS is free
 * to reclaim it once it has been handed off.
 */
export function writeCollectionExport(cards: Card[]): string {
  const payload = buildCollectionExport(cards);
  const file = freshCacheFile(`daily-pull-${stamp()}.json`);
  file.create();
  file.write(JSON.stringify(payload, null, 2));
  return file.uri;
}

// ------------------------------------------------------------------- the full archive

/**
 * A backup is one file, so it can go anywhere a file can go — Files, Drive, a chat with
 * yourself — and come back through a single picker.
 *
 * The layout is deliberately trivial to read:
 *
 *     DPBAK1\n                     magic + format version
 *     0000001234\n                 header length, ten ASCII digits
 *     {"format":"daily-pull-…"}    the header: every record, plus each photo's byte length
 *     <photo><photo><photo>…       the photos, concatenated, in the header's order
 *
 * It is written and read one photo at a time through a file handle, so a three-hundred-card
 * collection costs a few megabytes of memory rather than the size of the whole archive. That
 * rules out the obvious alternative of a zip built in JavaScript, which would have to hold
 * everything at once.
 */
const ARCHIVE_MAGIC = 'DPBAK1\n';
const ARCHIVE_EXTENSION = 'dpbak';
const HEADER_LENGTH_DIGITS = 10;

type ArchiveHeader = {
  format: 'daily-pull-backup';
  version: number;
  exportedAt: string;
  cards: {
    date: string;
    title: string | null;
    vibe: string | null;
    isHolo: boolean;
    createdAt: string;
    filterId: string | null;
    photoBytes: number;
  }[];
};

export type ArchiveResult = { uri: string; cardCount: number; skipped: string[] };

export async function writeBackupArchive(
  cards: Card[],
  onProgress?: (progress: BackupProgress) => void
): Promise<ArchiveResult> {
  const ordered = [...cards].sort((a, b) => a.date.localeCompare(b.date));

  // Sizes come from the file system rather than from reading the files, so the header can be
  // written before any photo is loaded.
  const skipped: string[] = [];
  const entries: { card: Card; file: File; size: number }[] = [];
  for (const card of ordered) {
    try {
      const file = new File(card.photoUri);
      if (!file.exists || file.size <= 0) {
        skipped.push(card.date);
        continue;
      }
      entries.push({ card, file, size: file.size });
    } catch {
      skipped.push(card.date);
    }
  }

  const header: ArchiveHeader = {
    format: 'daily-pull-backup',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    cards: entries.map(({ card, size }) => ({
      date: card.date,
      title: card.title ?? null,
      vibe: card.vibeType ?? null,
      isHolo: card.isHolo,
      createdAt: card.createdAt,
      filterId: card.filterId ?? null,
      photoBytes: size,
    })),
  };

  const destination = freshCacheFile(`daily-pull-${stamp()}.${ARCHIVE_EXTENSION}`);
  destination.create();
  const handle = destination.open();
  try {
    const headerBytes = toAsciiBytes(JSON.stringify(header));
    handle.writeBytes(toAsciiBytes(ARCHIVE_MAGIC));
    handle.writeBytes(toAsciiBytes(`${String(headerBytes.length).padStart(HEADER_LENGTH_DIGITS, '0')}\n`));
    handle.writeBytes(headerBytes);

    let done = 0;
    for (const entry of entries) {
      handle.writeBytes(await entry.file.bytes());
      done += 1;
      onProgress?.({ done, total: entries.length });
    }
  } finally {
    handle.close();
  }

  return { uri: destination.uri, cardCount: entries.length, skipped };
}

export type RestoreResult = {
  restored: number;
  /** Dates already in the binder, left untouched. */
  alreadyPresent: number;
  failed: string[];
  /** Set when the user cancelled the file picker rather than choosing a file. */
  cancelled?: boolean;
};

/**
 * Reads an archive back in.
 *
 * Existing days are never overwritten. A restore onto a phone that already has cards should be
 * additive — someone recovering a backup after using the app for a week should not lose that
 * week, and there is no way to ask "which of these two versions of Tuesday did you want" that
 * is worth the confusion.
 */
export async function restoreFromArchive(
  db: SQLiteDatabase,
  onProgress?: (progress: BackupProgress) => void
): Promise<RestoreResult> {
  // Not annotated: `pickFileAsync` is declared on the base class and returns the base `File`,
  // which is structurally narrower than the `File` this module imports. Inference keeps both
  // sides honest without a cast.
  const picked = await pickBackupFile();
  if (!picked) return { restored: 0, alreadyPresent: 0, failed: [], cancelled: true };

  const handle = picked.open();
  try {
    const magic = fromAsciiBytes(handle.readBytes(ARCHIVE_MAGIC.length));
    if (magic !== ARCHIVE_MAGIC) {
      throw new Error("That file isn't a Daily Pull backup.");
    }

    const headerLength = Number.parseInt(fromAsciiBytes(handle.readBytes(HEADER_LENGTH_DIGITS + 1)), 10);
    if (!Number.isFinite(headerLength) || headerLength <= 0) {
      throw new Error('That backup file is damaged and could not be read.');
    }

    const header = JSON.parse(fromAsciiBytes(handle.readBytes(headerLength))) as ArchiveHeader;
    if (header.format !== 'daily-pull-backup') {
      throw new Error("That file isn't a Daily Pull backup.");
    }
    if (header.version > EXPORT_FORMAT_VERSION) {
      throw new Error('That backup was made by a newer version of Daily Pull.');
    }

    const existing = await getExistingCardDates(db);
    const total = header.cards.length;
    const failed: string[] = [];
    let restored = 0;
    let alreadyPresent = 0;

    for (const [index, entry] of header.cards.entries()) {
      // The photos are laid out back to back, so every one has to be consumed in order even
      // when its record is skipped — otherwise the read head lands mid-photo on the next card.
      const bytes = handle.readBytes(entry.photoBytes);

      if (existing.has(entry.date)) {
        alreadyPresent += 1;
      } else {
        try {
          const stored = await writeRestoredPhoto(entry.date, bytes);
          await insertCard(db, {
            date: entry.date,
            photoUri: stored.photoUri,
            thumbUri: stored.thumbUri,
            filterId: entry.filterId,
            title: entry.title,
            vibeType: (entry.vibe as VibeType | null) ?? null,
            isHolo: entry.isHolo,
            createdAt: entry.createdAt,
          });
          existing.add(entry.date);
          restored += 1;
        } catch (error) {
          failed.push(entry.date);
          console.error('[backup] could not restore card', entry.date, error);
        }
      }
      onProgress?.({ done: index + 1, total });
    }

    return { restored, alreadyPresent, failed };
  } finally {
    handle.close();
  }
}

// --------------------------------------------------------------------- photo library

export type SaveAllResult = { saved: number; failed: string[] };

/**
 * Copies every card photo into the OS photo library, collected into a "Daily Pull" album
 * where the platform supports it.
 *
 * Failures are collected rather than thrown: one unreadable file should not abandon the other
 * three hundred, and the caller reports the real numbers instead of a blanket success.
 */
export async function saveAllPhotosToLibrary(
  cards: Card[],
  onProgress?: (progress: BackupProgress) => void
): Promise<SaveAllResult> {
  const total = cards.length;
  const failed: string[] = [];
  let saved = 0;
  let firstAsset: MediaLibrary.Asset | null = null;

  for (const card of cards) {
    try {
      const uri = card.photoUri.startsWith('file://') ? card.photoUri : `file://${card.photoUri}`;
      const asset = await MediaLibrary.createAssetAsync(uri);
      if (!firstAsset) firstAsset = asset;
      saved += 1;
    } catch (error) {
      failed.push(card.date);
      console.error('[backup] could not save photo', card.date, error);
    }
    onProgress?.({ done: saved + failed.length, total });
  }

  // Album grouping is best-effort — if it isn't permitted, the photos are still saved, which
  // is the part that matters.
  if (firstAsset) {
    try {
      const existing = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (existing) {
        await MediaLibrary.addAssetsToAlbumAsync([firstAsset], existing, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM_NAME, firstAsset, false);
      }
    } catch (error) {
      console.warn('[backup] could not group photos into an album', error);
    }
  }

  return { saved, failed };
}

// -------------------------------------------------------------------------- plumbing

/** Returns null when the picker is dismissed — which it signals by throwing, not resolving. */
async function pickBackupFile() {
  try {
    const selection = await File.pickFileAsync();
    return Array.isArray(selection) ? (selection[0] ?? null) : selection;
  } catch {
    return null;
  }
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A named file in the cache's exports folder, with any previous copy cleared out. */
function freshCacheFile(name: string): File {
  const directory = new Directory(Paths.cache, 'exports');
  if (!directory.exists) directory.create({ intermediates: true });
  const file = new File(directory, name);
  if (file.exists) file.delete();
  return file;
}

/**
 * UTF-8 text as bytes, via JSON's own `\uXXXX` escaping for anything outside printable ASCII.
 *
 * `TextEncoder` would be the obvious tool, but its presence depends on the JS engine build, and
 * a backup that silently fails to write on one runtime is worse than a slightly larger file.
 * Escaping first means every remaining character is one byte, and `JSON.parse` turns the
 * escapes back into the original text on the way in — so a title in any script survives the
 * round trip.
 */
function toAsciiBytes(text: string): Uint8Array {
  const escaped = text.replace(/[^\x20-\x7E]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  const bytes = new Uint8Array(escaped.length);
  for (let index = 0; index < escaped.length; index += 1) {
    bytes[index] = escaped.charCodeAt(index);
  }
  return bytes;
}

/** Chunked because spreading a large array into `String.fromCharCode` overflows the stack. */
function fromAsciiBytes(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let out = '';
  for (let index = 0; index < bytes.length; index += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return out;
}
