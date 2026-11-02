import type { FillKeyInput } from '@mechane/protocol';
import type { DatabaseFunctions } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type { CachedKeyRow } from './schemas.ts';

/** What a shard's store does with its keys. */
export type CachedKeyRecords = {
  /** The shard's row of the token's hash, none before a fill or a revocation wrote one. */
  readonly cachedKey: (input: CachedKeyInput) => Option.Option<CachedKeyRow>;
  /**
   * Stores a key the directory resolved, unless the shard holds a row for its token already, a tombstone included. It
   * answers the row the shard holds for the token after it.
   */
  readonly fillKey: (input: FillKeyInput) => CachedKeyRow;
  /** Marks the key of the token revoked, keeping an earlier revocation's time, whether or not the shard held it. */
  readonly revokeKey: (input: RevokeKeyInput) => void;
};

export type CachedKeyInput = { readonly tokenHash: string };

/** A key cache shard's database functions; the store is the only code that runs SQL against a shard. */
export type KeyCacheStore = DatabaseFunctions & CachedKeyRecords;

export type RevokeKeyInput = { readonly tokenHash: string; readonly now: DateTime.Utc };
