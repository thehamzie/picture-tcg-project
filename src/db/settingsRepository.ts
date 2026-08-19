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

export const DEFAULT_REMINDER_HOUR = 20;
export const DEFAULT_REMINDER_MINUTE = 0;

export type ReminderSetting = { enabled: boolean; hour: number; minute: number };

/**
 * The daily reminder was previously scheduled once during onboarding and then unreachable —
 * there was nowhere to change the time or turn it off. Persisting it here lets Settings show
 * and edit what is actually scheduled.
 */
export async function getReminder(db: SQLiteDatabase): Promise<ReminderSetting> {
  const [enabled, hour, minute] = await Promise.all([
    getSetting(db, 'reminder_enabled'),
    getSetting(db, 'reminder_hour'),
    getSetting(db, 'reminder_minute'),
  ]);
  return {
    // Absent means "onboarding scheduled one but never recorded it" — treat as on, which
    // matches what the user will actually be receiving.
    enabled: enabled === null ? true : enabled === '1',
    hour: hour !== null ? Number(hour) : DEFAULT_REMINDER_HOUR,
    minute: minute !== null ? Number(minute) : DEFAULT_REMINDER_MINUTE,
  };
}

export async function setReminder(db: SQLiteDatabase, reminder: ReminderSetting): Promise<void> {
  await Promise.all([
    setSetting(db, 'reminder_enabled', reminder.enabled ? '1' : '0'),
    setSetting(db, 'reminder_hour', String(reminder.hour)),
    setSetting(db, 'reminder_minute', String(reminder.minute)),
  ]);
}

export async function getSkinId(db: SQLiteDatabase): Promise<SkinId> {
  const value = await getSetting(db, 'skin_id');
  return (value as SkinId | null) ?? DEFAULT_SKIN_ID;
}

export async function setSkinId(db: SQLiteDatabase, skinId: SkinId): Promise<void> {
  await setSetting(db, 'skin_id', skinId);
}
