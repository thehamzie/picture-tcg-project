import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getSkinId, setSkinId as persistSkinId } from '../db/settingsRepository';
import { DEFAULT_SKIN_ID, SKINS, type SkinId, type SkinTokens } from './skins';

type SkinContextValue = {
  skin: SkinTokens;
  skinId: SkinId;
  setSkin: (skinId: SkinId) => Promise<void>;
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [skinId, setSkinIdState] = useState<SkinId>(DEFAULT_SKIN_ID);

  useEffect(() => {
    let cancelled = false;
    getSkinId(db).then((id) => {
      if (!cancelled) setSkinIdState(id);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const setSkin = useCallback(
    async (id: SkinId) => {
      setSkinIdState(id);
      await persistSkinId(db, id);
    },
    [db]
  );

  const value = useMemo<SkinContextValue>(
    () => ({ skin: SKINS[skinId], skinId, setSkin }),
    [skinId, setSkin]
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin(): SkinContextValue {
  const context = useContext(SkinContext);
  if (!context) {
    throw new Error('useSkin must be used within a SkinProvider');
  }
  return context;
}
