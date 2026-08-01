import type { SQLiteDatabase } from 'expo-sqlite';

import { type Card, type CardRow, rowToCard } from '../types/card';

export async function getAllCards(db: SQLiteDatabase): Promise<Card[]> {
  const rows = await db.getAllAsync<CardRow>('SELECT * FROM cards ORDER BY date DESC');
  return rows.map(rowToCard);
}

export async function getCardByDate(db: SQLiteDatabase, date: string): Promise<Card | null> {
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE date = ?', [date]);
  return row ? rowToCard(row) : null;
}

export async function insertCard(
  db: SQLiteDatabase,
  input: { date: string; photoUri: string }
): Promise<Card> {
  const createdAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO cards (date, photo_uri, vibe_type, is_holo, created_at) VALUES (?, ?, NULL, 0, ?)',
    [input.date, input.photoUri, createdAt]
  );
  const card = await getCardByDate(db, input.date);
  if (!card) {
    throw new Error('Failed to read back inserted card');
  }
  return card;
}
