export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

const ABBREVIATED_MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

/** Formats a `YYYY-MM-DD` date key as e.g. "aug 3", for display on a card face. */
export function formatCardDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${ABBREVIATED_MONTH_NAMES[Number(month) - 1]} ${Number(day)}`;
}
