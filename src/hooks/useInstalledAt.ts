import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getInstalledAt } from '../db/settingsRepository';

export function useInstalledAt() {
  const db = useSQLiteContext();
  const [installedAt, setInstalledAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInstalledAt(db).then((value) => {
      if (!cancelled) setInstalledAt(value);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  return installedAt;
}
