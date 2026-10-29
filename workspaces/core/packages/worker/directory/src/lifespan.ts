import type { Lifespan } from '@mechane/directory-store';
import { DateTime } from 'effect';
import type { Duration } from 'effect';

/** The instant a record opens at, and how long it lives as the Worker gives it. */
type LifespanInput = { readonly now: DateTime.Utc; readonly lifetime: Duration.Duration };

/** When a record the directory opens is created and when it expires, by the directory's own clock. */
export function lifespan({ now, lifetime }: LifespanInput): Lifespan {
  return { createdAt: now, expiresAt: DateTime.addDuration(now, lifetime) };
}
