import type { LimitPolicy } from '@mechane/deployment';
import type { DatabaseFunctions } from '@mechane/store';
import type { Option } from 'effect';
import type { LimitWindowRow } from './schemas.ts';

/** What a limiter's store does with its windows. */
export type LimitWindowRecords = {
  /** The policy's current window, none before the policy's first request. */
  readonly limitWindow: (input: LimitWindowInput) => Option.Option<LimitWindowRow>;
  /** Stores the policy's window, replacing the one it held, which a new window outlived or this request counted in. */
  readonly writeWindow: (input: WriteWindowInput) => void;
};

/** A policy's window to store: when it opened, and the requests it has taken with the one just counted. */
export type WriteWindowInput = LimitWindowInput & LimitWindowRow;

export type LimitWindowInput = { readonly policy: LimitPolicy };

/** A limiter's database functions; the store is the only code that runs SQL against a limiter. */
export type LimiterStore = DatabaseFunctions & LimitWindowRecords;
