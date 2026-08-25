/**
 * Date helpers built on the *local* calendar.
 *
 * `toLocaleDateString` is deliberately avoided: its output depends on the ICU
 * data of whatever runtime renders it, which differs between the Vercel build
 * container and the visitor browser. Fixed label tables keep the markup
 * identical on both sides and hydration quiet.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Column headers for the month grid. Duplicated letters are intentional. */
export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `Date` to `YYYY-MM-DD`, using local calendar fields rather than UTC. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** `YYYY-MM-DD` to local midnight. `new Date(key)` would parse it as UTC. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Safe as a string compare: the format is zero-padded and ordered. */
export function isBefore(key: string, other: string): boolean {
  return key < other;
}

export function formatDateLong(key: string): string {
  const date = fromDateKey(key);
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  return `${weekday}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatDateShort(key: string): string {
  const date = fromDateKey(key);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function formatWeekday(key: string): string {
  return WEEKDAYS_SHORT[fromDateKey(key).getDay()];
}

export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

export function formatSlotRange(hour: number): string {
  return `${formatHour(hour)} - ${formatHour(hour + 1)}`;
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTHS[monthIndex]} ${year}`;
}

/**
 * Weeks of date keys for a month, with `null` in the leading and trailing
 * blanks. Rows are always seven wide; no all-null row is ever emitted, so a
 * short month does not render a dead sixth row.
 */
export function buildMonthGrid(year: number, monthIndex: number): (string | null)[][] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const lead = new Date(year, monthIndex, 1).getDay();

  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${year}-${pad2(monthIndex + 1)}-${pad2(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export interface MonthCursor {
  year: number;
  monthIndex: number;
}

export function monthOf(key: string): MonthCursor {
  const date = fromDateKey(key);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const date = new Date(cursor.year, cursor.monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function sameMonth(a: MonthCursor, b: MonthCursor): boolean {
  return a.year === b.year && a.monthIndex === b.monthIndex;
}
