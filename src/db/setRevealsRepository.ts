import type { SQLiteDatabase } from 'expo-sqlite';

export async function hasSetBeenRevealed(db: SQLiteDatabase, setStartDate: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ set_start_date: string }>(
    'SELECT set_start_date FROM set_reveals WHERE set_start_date = ?',
    [setStartDate]
  );
  return row !== null;
}

export async function markSetRevealed(db: SQLiteDatabase, setStartDate: string): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO set_reveals (set_start_date, revealed_at) VALUES (?, ?)',
    [setStartDate, new Date().toISOString()]
  );
}

export async function getAllRevealedSetDates(db: SQLiteDatabase): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ set_start_date: string }>('SELECT set_start_date FROM set_reveals');
  return new Set(rows.map((row) => row.set_start_date));
}
