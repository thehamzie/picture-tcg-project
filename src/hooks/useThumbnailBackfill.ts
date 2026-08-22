import { useEffect, useRef } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { setCardThumb } from '../db/cardsRepository';
import { backfillThumbnail } from '../utils/photoStorage';

// Builds thumbnails for cards captured before thumbnails existed.
//
// The binder grid and every share template draw photos at around a hundred points wide. Before
// thumbnails, each of those slots decoded a full 12MP JPEG, which is what made a binder with a
// few months in it heavy to scroll. New cards get a thumbnail at capture; this fills in the
// backlog.
//
// Deliberately unhurried: a few at a time, with a gap between batches, and any failure is
// dropped rather than retried. Nothing depends on it finishing — `displayThumb` falls back to
// the full photo — so it must never compete with the UI for the frame budget.

const BATCH_SIZE = 4;
const BATCH_PAUSE_MS = 600;

let hasRunThisSession = false;

/** Resets the once-per-session guard. Restore calls this, since it imports fresh rows. */
export function resetThumbnailBackfill() {
  hasRunThisSession = false;
}

export function useThumbnailBackfill() {
  const db = useSQLiteContext();
  const cancelled = useRef(false);

  useEffect(() => {
    if (hasRunThisSession) return;
    hasRunThisSession = true;
    cancelled.current = false;

    run(db, cancelled).catch((error) => {
      console.warn('[thumbnails] backfill stopped', error);
    });

    return () => {
      cancelled.current = true;
    };
  }, [db]);
}

async function run(db: SQLiteDatabase, cancelled: { current: boolean }) {
  for (;;) {
    if (cancelled.current) return;

    const rows = await db.getAllAsync<{ id: number; date: string; photo_uri: string }>(
      'SELECT id, date, photo_uri FROM cards WHERE thumb_uri IS NULL ORDER BY date DESC LIMIT ?',
      [BATCH_SIZE]
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      if (cancelled.current) return;
      const thumbUri = await backfillThumbnail(row.photo_uri, row.date);
      // On failure, point the thumbnail at the photo itself. That costs nothing at read time
      // and stops the query above from handing back the same unreadable row forever.
      await setCardThumb(db, row.id, thumbUri ?? row.photo_uri);
    }

    await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
  }
}
