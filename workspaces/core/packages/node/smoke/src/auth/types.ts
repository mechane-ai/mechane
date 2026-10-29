import type { Stack } from '@mechane/stack';
import type { Account } from '@mechane/testing';

/** An account of the stack a helper runs as. */
export type AccountInput = { readonly stack: Stack; readonly account: Account };
