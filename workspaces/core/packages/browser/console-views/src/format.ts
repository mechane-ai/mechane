import { DateTime } from 'effect';

/** A recorded UTC timestamp rendered in the viewer's locale. */
export function timeLabel(value: DateTime.Utc): string {
  return DateTime.toDateUtc(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const MICROS_PER_DOLLAR = 1_000_000;

/** A micro-dollar amount rendered as a USD cost. */
export function moneyLabel(micros: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(micros / MICROS_PER_DOLLAR);
}
