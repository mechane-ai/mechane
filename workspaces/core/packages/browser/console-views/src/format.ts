import { DateTime, Duration } from 'effect';

const DURATION_PRECISION = 2;

/** Stable UTC display for a recorded timestamp, independent of the viewer's locale. */
export function timeLabel(value: DateTime.Utc): string {
  const label = DateTime.toDateUtc(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });

  return `${label} UTC`;
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(micros / MICROS_PER_DOLLAR);
}
