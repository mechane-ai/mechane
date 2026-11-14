export type CalendarDate = { readonly year: number; readonly month: number; readonly day: number };
export type CalendarMonth = { readonly year: number; readonly month: number };
export type DateRange = { readonly from: CalendarDate; readonly to: CalendarDate };
export type MonthRange = { readonly from: CalendarMonth; readonly to: CalendarMonth };

const gregorian = {
  maximumYear: 9999,
  monthsPerYear: 12,
  leapCycle: 4,
  century: 100,
  leapCentury: 400,
  longMonthDays: 31,
  shortMonthDays: 30,
  februaryDays: 28,
  leapFebruaryDays: 29,
  yearDigits: 4,
  componentDigits: 2,
} as const;

export function isMonth(value: CalendarMonth): boolean {
  const isYear = Number.isInteger(value.year) && value.year >= 1 && value.year <= gregorian.maximumYear;

  if (!isYear) {
    return false;
  }

  return Number.isInteger(value.month) && value.month >= 1 && value.month <= gregorian.monthsPerYear;
}

export function isDate(value: CalendarDate): boolean {
  if (!isMonth(value) || !Number.isInteger(value.day) || value.day < 1) {
    return false;
  }

  const isLeapYear =
    value.year % gregorian.leapCycle === 0 &&
    (value.year % gregorian.century !== 0 || value.year % gregorian.leapCentury === 0);

  const february = isLeapYear ? gregorian.leapFebruaryDays : gregorian.februaryDays;
  const { longMonthDays, shortMonthDays } = gregorian;

  const days = [
    longMonthDays,
    february,
    longMonthDays,
    shortMonthDays,
    longMonthDays,
    shortMonthDays,
    longMonthDays,
    longMonthDays,
    shortMonthDays,
    longMonthDays,
    shortMonthDays,
    longMonthDays,
  ];

  return value.day <= (days[value.month - 1] ?? 0);
}

export function monthOrder(value: CalendarMonth): number {
  return value.year * gregorian.monthsPerYear + value.month;
}

export function serializeCalendarDate(value: CalendarDate): string {
  if (!isDate(value)) {
    throw new RangeError('Cannot serialize an invalid calendar date.');
  }

  return `${serializeCalendarMonth(value)}-${String(value.day).padStart(gregorian.componentDigits, '0')}`;
}

export function serializeCalendarMonth(value: CalendarMonth): string {
  if (!isMonth(value)) {
    throw new RangeError('Cannot serialize an invalid calendar month.');
  }

  return `${String(value.year).padStart(gregorian.yearDigits, '0')}-${String(value.month).padStart(gregorian.componentDigits, '0')}`;
}

export function parseCalendarDate(value: string): CalendarDate | undefined {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = { year, month, day };

  return isDate(date) && serializeCalendarDate(date) === value ? date : undefined;
}

export function parseCalendarMonth(value: string): CalendarMonth | undefined {
  const [year = 0, month = 0] = value.split('-').map(Number);
  const date = { year, month };

  return isMonth(date) && serializeCalendarMonth(date) === value ? date : undefined;
}

export function addCalendarDays(value: CalendarDate, amount: number): CalendarDate {
  if (!isDate(value) || !Number.isInteger(amount)) {
    throw new RangeError('Calendar-day arithmetic requires a valid date and integer offset.');
  }

  const date = new Date(`${serializeCalendarDate(value)}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + amount);

  const result = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };

  if (!isDate(result)) {
    throw new RangeError('Calendar-day arithmetic exceeds the supported years 1–9999.');
  }

  return result;
}

export function addCalendarMonths(value: CalendarMonth, amount: number): CalendarMonth {
  if (!isMonth(value) || !Number.isInteger(amount)) {
    throw new RangeError('Calendar-month arithmetic requires a valid month and integer offset.');
  }

  const index = (value.year - 1) * gregorian.monthsPerYear + value.month - 1 + amount;

  const result = {
    year: Math.floor(index / gregorian.monthsPerYear) + 1,
    month: (index % gregorian.monthsPerYear) + 1,
  };

  if (!isMonth(result)) {
    throw new RangeError('Calendar-month arithmetic exceeds the supported years 1–9999.');
  }

  return result;
}

export function formatDate(value: CalendarDate, locale: string): string {
  if (!isDate(value)) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC', calendar: 'gregory' }).format(
    Date.parse(`${serializeCalendarDate(value)}T12:00:00Z`),
  );
}

export function formatMonth(value: CalendarMonth, locale: string): string {
  if (!isMonth(value)) {
    return 'Invalid month';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    calendar: 'gregory',
  }).format(Date.parse(`${serializeCalendarMonth(value)}-01T12:00:00Z`));
}

export function dateValidation(
  value: CalendarDate,
  minimum?: CalendarDate,
  maximum?: CalendarDate,
): string | undefined {
  if (!isDate(value)) {
    return 'Select a valid date.';
  }

  if (minimum !== undefined && serializeCalendarDate(value) < serializeCalendarDate(minimum)) {
    return `Select a date on or after ${serializeCalendarDate(minimum)}.`;
  }

  if (maximum !== undefined && serializeCalendarDate(value) > serializeCalendarDate(maximum)) {
    return `Select a date on or before ${serializeCalendarDate(maximum)}.`;
  }

  return undefined;
}

export function monthValidation(
  value: CalendarMonth,
  minimum?: CalendarMonth,
  maximum?: CalendarMonth,
): string | undefined {
  if (!isMonth(value)) {
    return 'Select a valid month.';
  }

  if (minimum !== undefined && monthOrder(value) < monthOrder(minimum)) {
    return `Select a month on or after ${serializeCalendarMonth(minimum)}.`;
  }

  if (maximum !== undefined && monthOrder(value) > monthOrder(maximum)) {
    return `Select a month on or before ${serializeCalendarMonth(maximum)}.`;
  }

  return undefined;
}
