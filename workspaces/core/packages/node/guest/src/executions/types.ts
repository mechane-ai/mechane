import type { ExecutionId, ExecutionReceipt, SettledReceipt } from '@mechane/sandbox-wire';
import type { Deferred, Effect } from 'effect';

/** A spawned bash: its exit code once it exits, its pipes' close, the kill of its group, and its output's tail. */
export type BashRun = {
  readonly exited: Deferred.Deferred<number>;
  readonly closed: Deferred.Deferred<void>;
  readonly kill: Effect.Effect<void>;
  readonly output: () => SettledReceipt['output'];
};

/** A settled execution's receipt to keep under its id. */
export type KeepInput = { readonly executionId: ExecutionId; readonly receipt: SettledReceipt };

/** The settled receipts, of which only the newest keep their text, and a receipt by id, running until it settles. */
export type SettledReceipts = {
  readonly keep: (input: KeepInput) => void;
  readonly receipt: (input: ExecutionIdInput) => ExecutionReceipt;
};

export type ExecutionIdInput = { readonly executionId: ExecutionId };
