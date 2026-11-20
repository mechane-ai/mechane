import { DateTime, Duration } from 'effect';

const DURATION_PRECISION = 2;

/** Trace timestamps include milliseconds so adjacent events can be distinguished. */
export function preciseTimeLabel(value: DateTime.Utc): string {
  return DateTime.toDateUtc(value).toISOString();
}

/** An elapsed interval, without assuming an unfinished operation has ended. */
export function durationLabel(milliseconds: number): string {
  const second = Duration.toMillis('1 second');

  return milliseconds < second ? `${milliseconds}ms` : `${(milliseconds / second).toFixed(DURATION_PRECISION)}s`;
}
