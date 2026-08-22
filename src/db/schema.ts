import type { SQLiteDatabase } from 'expo-sqlite';

import { todayDateKey } from '../utils/date';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      photo_uri TEXT NOT NULL,
      thumb_uri TEXT,
      filter_id TEXT,
      title TEXT,
      vibe_type TEXT,
      is_holo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS set_reveals (
      set_start_date TEXT PRIMARY KEY NOT NULL,
      revealed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  // Guards upgrades of an existing `cards` table (the CREATE TABLE above only applies to a
  // brand-new db file). Safe to run every launch — each errors harmlessly on a db that already
  // has the column, which is why the rejection is swallowed rather than logged.
  //
  //   title      added with the Daily Pull rebuild
  //   thumb_uri  a small derivative used by the binder grid; null on cards captured before it
  //              existed, and backfilled lazily by useThumbnailBackfill
  //   filter_id  which camera filter was baked into this photo, kept for display only — the
  //              filter is not reversible, so this is a record, not a setting
  for (const column of ['title TEXT', 'thumb_uri TEXT', 'filter_id TEXT']) {
    await db.runAsync(`ALTER TABLE cards ADD COLUMN ${column}`).catch(() => {});
  }
  await db.runAsync('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)', [
    'installed_at',
    todayDateKey(),
  ]);
}
