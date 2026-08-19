import type { Card } from '../types/card';
import { addDays, fromDateKey, toDateKey } from './date';

/** A Set is a Monday–Sunday calendar week (see PLAN.md "Sets"). */
export function getMondayOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

/** Returns the 7 date keys (Monday first) for the week starting at `mondayDate`. */
export function getWeekDateKeys(mondayDate: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(mondayDate, index)));
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getWeeksBetween(fromMonday: Date, toMonday: Date): number {
  return Math.round((toMonday.getTime() - fromMonday.getTime()) / MS_PER_WEEK);
}

export type SetSummary = {
  startDate: string; // Monday date key
  setNumber: number; // derived, not stored — see PLAN.md "Sets"
  dateKeys: string[]; // 7 keys, Monday first
  cards: (Card | null)[]; // aligned with dateKeys
  cardCount: number;
  isComplete: boolean;
};

/**
 * Builds every Set from the account's first Set (the week its earliest captured card falls
 * in) through the current week, oldest first. Set 1 is anchored to the earliest card's date,
 * per explicit product decision — not `installedAt`, so an account that installs but doesn't
 * capture right away doesn't accrue "missed" weeks before it has any cards. `fallbackAnchor`
 * (typically `installedAt`) is only used when `cards` is empty, since there's no card date to
 * anchor to yet — in that case the Binder shows its empty state instead of these Sets anyway.
 */
export function buildSets(cards: Card[], fallbackAnchor: string): SetSummary[] {
  const cardsByDate = new Map(cards.map((card) => [card.date, card]));
  const earliestCardDate =
    cards.length > 0 ? cards.reduce((min, card) => (card.date < min ? card.date : min), cards[0].date) : fallbackAnchor;
  const firstMonday = getMondayOfWeek(fromDateKey(earliestCardDate));
  const currentMonday = getMondayOfWeek(new Date());
  const totalWeeks = getWeeksBetween(firstMonday, currentMonday) + 1;

  const sets: SetSummary[] = [];
  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const monday = addDays(firstMonday, weekIndex * 7);
    const dateKeys = getWeekDateKeys(monday);
    const weekCards = dateKeys.map((key) => cardsByDate.get(key) ?? null);
    const cardCount = weekCards.filter((card): card is Card => card !== null).length;
    sets.push({
      startDate: toDateKey(monday),
      setNumber: weekIndex + 1,
      dateKeys,
      cards: weekCards,
      cardCount,
      isComplete: cardCount === 7,
    });
  }
  return sets;
}

/**
 * Derives the Set number for a single date without building every Set — used by Export.
 * `anchorDate` should be the account's earliest captured card date (Set 1's anchor).
 */
export function getSetNumberForDate(dateKey: string, anchorDate: string): number {
  const firstMonday = getMondayOfWeek(fromDateKey(anchorDate));
  const cardMonday = getMondayOfWeek(fromDateKey(dateKey));
  return getWeeksBetween(firstMonday, cardMonday) + 1;
}
