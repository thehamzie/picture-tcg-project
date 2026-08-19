import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import type { Card } from '../types/card';

// Getting a copy of the collection out of the app.
//
// Why this matters more than it looks: every photo lives in the app's own document directory
// and every record lives in a local SQLite file. Delete the app, lose the phone, or move to a
// device without a full encrypted backup, and the whole collection is gone with no warning
// and no recovery. For something meant to be kept for years, that is the one failure that
// actually hurts.
//
// This is deliberately two separate, honest operations rather than one "Backup" button that
// implies more than it delivers:
//
//   * `saveAllPhotosToLibrary` puts the irreplaceable part — the photographs — into the OS
//     photo library, which is already covered by iCloud / Google Photos. This is the part that
//     genuinely protects against data loss.
//   * `writeCollectionExport` writes the records (dates, titles, vibes, rarity, set numbering)
//     as a plain JSON file to share or file away.
//
// What this is NOT, and the UI says so: a one-tap restore. Re-importing is a separate feature
// — the export carries `photoFilename` precisely so a future import can re-link photos to
// records, but nothing reads it back yet.

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
    /** Basename of the stored photo, so a future import can re-link records to files. */
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
        photoFilename: card.photoUri.split('/').pop() ?? `${card.date}.jpg`,
      })),
  };
}

/**
 * Writes the export to a cache file and returns its URI, ready to hand to the share sheet.
 * Cache rather than documents: this is a transfer artefact, not app data, and the OS is free
 * to reclaim it once it has been handed off.
 */
export function writeCollectionExport(cards: Card[]): string {
  const payload = buildCollectionExport(cards);
  const directory = new Directory(Paths.cache, 'exports');
  if (!directory.exists) directory.create({ intermediates: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(directory, `daily-pull-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));
  return file.uri;
}

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
