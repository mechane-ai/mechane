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

export function dateInput(value: CalendarDate): string {
  return `${monthInput(value)}-${String(value.day).padStart(gregorian.componentDigits, '0')}`;
}

export function monthInput(value: CalendarMonth): string {
  return `${String(value.year).padStart(gregorian.yearDigits, '0')}-${String(value.month).padStart(gregorian.componentDigits, '0')}`;
}

export function parseDate(value: string): CalendarDate | undefined {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = { year, month, day };

  return isDate(date) && dateInput(date) === value ? date : undefined;
}

export function parseMonth(value: string): CalendarMonth | undefined {
  const [year = 0, month = 0] = value.split('-').map(Number);
  const date = { year, month };

  return isMonth(date) && monthInput(date) === value ? date : undefined;
}

export function formatDate(value: CalendarDate, locale: string): string {
  if (!isDate(value)) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC', calendar: 'gregory' }).format(
    Date.parse(`${dateInput(value)}T12:00:00Z`),
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
  }).format(Date.parse(`${monthInput(value)}-01T12:00:00Z`));
}

export function dateValidation(
  value: CalendarDate,
  minimum?: CalendarDate,
  maximum?: CalendarDate,
): string | undefined {
  if (!isDate(value)) {
    return 'Select a valid date.';
  }

  if (minimum !== undefined && dateInput(value) < dateInput(minimum)) {
    return `Select a date on or after ${dateInput(minimum)}.`;
  }

  if (maximum !== undefined && dateInput(value) > dateInput(maximum)) {
    return `Select a date on or before ${dateInput(maximum)}.`;
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
    return `Select a month on or after ${monthInput(minimum)}.`;
  }

  if (maximum !== undefined && monthOrder(value) > monthOrder(maximum)) {
    return `Select a month on or before ${monthInput(maximum)}.`;
  }

  return undefined;
}
