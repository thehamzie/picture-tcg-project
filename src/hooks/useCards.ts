import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getAllCards } from '../db/cardsRepository';
import type { Card } from '../types/card';

export function useCards() {
  const db = useSQLiteContext();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await getAllCards(db);
    setCards(rows);
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { cards, loading, refresh };
}
