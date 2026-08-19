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

/** The date of the earliest captured card — anchors Set 1 (see PLAN.md "Sets"). */
export async function getEarliestCardDate(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ date: string }>('SELECT date FROM cards ORDER BY date ASC LIMIT 1');
  return row?.date ?? null;
}

export async function insertCard(
  db: SQLiteDatabase,
  input: {
    date: string;
    photoUri: string;
    title?: string | null;
    vibeType?: VibeType | null;
    isHolo?: boolean;
  }
): Promise<Card> {
  const createdAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO cards (date, photo_uri, title, vibe_type, is_holo, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      input.date,
      input.photoUri,
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
