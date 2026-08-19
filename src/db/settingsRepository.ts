import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_SKIN_ID, type SkinId } from '../theme/skins';
import { todayDateKey } from '../utils/date';

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function getInstalledAt(db: SQLiteDatabase): Promise<string> {
  const value = await getSetting(db, 'installed_at');
  return value ?? todayDateKey();
}

export async function getOnboardingComplete(db: SQLiteDatabase): Promise<boolean> {
  const value = await getSetting(db, 'onboarding_complete');
  return value === '1';
}

export async function setOnboardingComplete(db: SQLiteDatabase): Promise<void> {
  await setSetting(db, 'onboarding_complete', '1');
}

export async function getSkinId(db: SQLiteDatabase): Promise<SkinId> {
  const value = await getSetting(db, 'skin_id');
  return (value as SkinId | null) ?? DEFAULT_SKIN_ID;
}

export async function setSkinId(db: SQLiteDatabase, skinId: SkinId): Promise<void> {
  await setSetting(db, 'skin_id', skinId);
}
