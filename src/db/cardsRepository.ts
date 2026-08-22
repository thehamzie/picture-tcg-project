import type { SQLiteDatabase } from 'expo-sqlite';

import type { VibeType } from '../theme/theme';
import { type Card, type CardRow, rowToCard } from '../types/card';

export async function getAllCards(db: SQLiteDatabase): Promise<Card[]> {
  const rows = await db.getAllAsync<CardRow>('SELECT * FROM cards ORDER BY date DESC');
  return rows.map(rowToCard);
}

export async function getCardByDate(db: SQLiteDatabase, date: string): Promise<Card | null> {
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE date = ?', [date]);
  return row ? rowToCard(row) : null;
}

export async function getCardById(db: SQLiteDatabase, id: number): Promise<Card | null> {
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ?', [id]);
  return row ? rowToCard(row) : null;
}

/** Every date that already has a card. Restore uses it to avoid overwriting existing days. */
export async function getExistingCardDates(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ date: string }>('SELECT date FROM cards');
  return new Set(rows.map((row) => row.date));
}

/** The date of the earliest captured card — anchors Set 1 (see PLAN.md "Sets"). */
export async function getEarliestCardDate(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ date: string }>('SELECT date FROM cards ORDER BY date ASC LIMIT 1');
  return row?.date ?? null;
}

/**
 * Edits the two fields a user can get wrong at capture time. Deliberately narrow: the photo,
 * date, holo roll and card number are all part of what makes a card a record of that day, so
 * they stay immutable — only the title and vibe tag can be corrected afterwards.
 */
export async function updateCardDetails(
  db: SQLiteDatabase,
  id: number,
  input: { title: string | null; vibeType: VibeType | null }
): Promise<void> {
  await db.runAsync('UPDATE cards SET title = ?, vibe_type = ? WHERE id = ?', [
    input.title,
    input.vibeType,
    id,
  ]);
}

/**
 * Removes a card. The photo file is deleted separately by the caller — the row and the file
 * are cleaned up together so a failure can't leave the DB pointing at a missing file.
 */
export async function deleteCard(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}

/** Records a thumbnail generated after the fact — see `useThumbnailBackfill`. */
export async function setCardThumb(db: SQLiteDatabase, id: number, thumbUri: string): Promise<void> {
  await db.runAsync('UPDATE cards SET thumb_uri = ? WHERE id = ?', [thumbUri, id]);
}

export async function insertCard(
  db: SQLiteDatabase,
  input: {
    date: string;
    photoUri: string;
    thumbUri?: string | null;
    filterId?: string | null;
    title?: string | null;
    vibeType?: VibeType | null;
    isHolo?: boolean;
    /** Restore passes the original timestamp; capture leaves it out and gets "now". */
    createdAt?: string;
  }
): Promise<Card> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  await db.runAsync(
    'INSERT INTO cards (date, photo_uri, thumb_uri, filter_id, title, vibe_type, is_holo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      input.date,
      input.photoUri,
      input.thumbUri ?? null,
      input.filterId ?? null,
      input.title ?? null,
      input.vibeType ?? null,
      input.isHolo ? 1 : 0,
      createdAt,
    ]
  );
  const card = await getCardByDate(db, input.date);
  if (!card) {
    throw new Error('Failed to read back inserted card');
  }
  return card;
}
