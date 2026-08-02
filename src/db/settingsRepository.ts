import type { SQLiteDatabase } from 'expo-sqlite';

import { todayDateKey } from '../utils/date';

export async function getInstalledAt(db: SQLiteDatabase): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    ['installed_at']
  );
  return row?.value ?? todayDateKey();
}
