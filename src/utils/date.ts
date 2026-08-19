export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
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

const ABBREVIATED_DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** e.g. "AUG 16" — the mono date as printed on a card's info plate. */
export function formatMonoDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${ABBREVIATED_MONTH_NAMES[Number(month) - 1].toUpperCase()} ${Number(day)}`;
}

/** e.g. "AUG 16 · SAT" — the full mono date row from the card-object-study mockup (2e). */
export function formatMonoDateWithDay(dateKey: string): string {
  return `${formatMonoDate(dateKey)} · ${ABBREVIATED_DAY_NAMES[fromDateKey(dateKey).getDay()]}`;
}

/** e.g. "MON · AUG 17 · 2026" — Today's header line. */
export function formatTodayHeaderDate(dateKey: string): string {
  const [year] = dateKey.split('-');
  return `${ABBREVIATED_DAY_NAMES[fromDateKey(dateKey).getDay()]} · ${formatMonoDate(dateKey)} · ${year}`;
}

/** e.g. "MON 10" — the day label under a binder grid slot (2f). */
export function formatGridDayLabel(dateKey: string): string {
  const [, , day] = dateKey.split('-');
  return `${ABBREVIATED_DAY_NAMES[fromDateKey(dateKey).getDay()]} ${Number(day)}`;
}

/** e.g. "AUG 10 — 16" for a same-month Set, or "JUL 27 — AUG 2" across a month boundary. */
export function formatSetRange(startKey: string, endKey: string): string {
  const [, startMonth, startDay] = startKey.split('-');
  const [, endMonth, endDay] = endKey.split('-');
  const start = `${ABBREVIATED_MONTH_NAMES[Number(startMonth) - 1].toUpperCase()} ${Number(startDay)}`;
  const end =
    startMonth === endMonth
      ? `${Number(endDay)}`
      : `${ABBREVIATED_MONTH_NAMES[Number(endMonth) - 1].toUpperCase()} ${Number(endDay)}`;
  return `${start} — ${end}`;
}
