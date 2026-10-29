import type { Stack } from '@mechane/stack';
import type { Account } from '../types.ts';

/** A CLI command to run through a device approval as the account, and the schema that decodes its result. */
export type ApprovedCliInput<S> = {
  readonly stack: Stack;
  readonly args: ReadonlyArray<string>;
  readonly account: Account;
  readonly result: S;
};
