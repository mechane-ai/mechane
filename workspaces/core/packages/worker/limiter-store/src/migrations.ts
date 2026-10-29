import type { Migration } from '@mechane/store';

/**
 * A limiter's schema steps in order, after the ledger that records them; append a step, and never edit one that has
 * shipped. A row is one policy's current window: when it opened, and the requests it took so far.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE windows (policy TEXT PRIMARY KEY, opened_at_ms INTEGER NOT NULL, taken INTEGER NOT NULL) STRICT',
    );
  },
];
