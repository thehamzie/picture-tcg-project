import type { SQLiteDatabase } from 'expo-sqlite';

import { todayDateKey } from '../utils/date';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      photo_uri TEXT NOT NULL,
      vibe_type TEXT,
      is_holo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  await db.runAsync('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)', [
    'installed_at',
    todayDateKey(),
  ]);
}
