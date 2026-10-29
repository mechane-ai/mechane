import { KeyMetadata, Principal } from '@mechane/protocol';
import { Schema } from 'effect';

/** The parts of a login's or a status's result a scenario reads: the account and its key. */
export const SignedIn = Schema.Struct({ principal: Principal, key: KeyMetadata });

export type SignedIn = typeof SignedIn.Type;
