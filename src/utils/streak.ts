import type { Card } from '../types/card';
import { addDays, toDateKey, todayDateKey } from './date';

export function computeDayStreak(cards: Card[]): number {
  const dateKeys = new Set(cards.map((card) => card.date));

  let cursor = new Date();
  if (!dateKeys.has(todayDateKey())) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (dateKeys.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
