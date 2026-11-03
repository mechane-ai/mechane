import { DateTime, Duration } from 'effect';

const DURATION_PRECISION = 2;

/** A recorded UTC timestamp rendered in the viewer's locale. */
export function timeLabel(value: DateTime.Utc): string {
  return DateTime.toDateUtc(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Compact record age; callers retain the absolute timestamp alongside it. */
export function ageLabel(value: DateTime.Utc): string {
  const elapsed = Math.max(0, DateTime.toEpochMillis(DateTime.nowUnsafe()) - DateTime.toEpochMillis(value));
  const minutes = Math.floor(elapsed / Duration.toMillis('1 minute'));

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < Duration.toMinutes('1 hour')) {
    return `${minutes}m`;
  }

  const hours = Math.floor(elapsed / Duration.toMillis('1 hour'));

  return hours < Duration.toHours('1 day') ? `${hours}h` : `${Math.floor(elapsed / Duration.toMillis('1 day'))}d`;
}

/** Trace timestamps include milliseconds so adjacent events can be distinguished. */
export function preciseTimeLabel(value: DateTime.Utc): string {
  return DateTime.toDateUtc(value).toISOString();
}

/** An elapsed interval, without assuming an unfinished operation has ended. */
export function durationLabel(milliseconds: number): string {
  const second = Duration.toMillis('1 second');

  return milliseconds < second ? `${milliseconds}ms` : `${(milliseconds / second).toFixed(DURATION_PRECISION)}s`;
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
