import { toDateKey } from './date';

export type MonthCell = { day: number; dateKey: string } | null;

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function getMonthWeeks(year: number, month: number): MonthCell[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();

  const cells: MonthCell[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, dateKey: toDateKey(new Date(year, month, day)) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}
