import type { ForkRow, MechRow } from '@mechane/mech-store';
import type { Sequence } from '@mechane/records';
import type { ForkAnswer } from '@mechane/rpc';
import type { Result } from 'effect';
import type { OpenedMech } from '../types.ts';

/**
 * A fork of an idle mech, or the retry of one cut off: the mech it copies and the fork as it was first recorded. It
 * holds the sequence of the mech's last event its copy holds, and whether the new mech holds that copy already.
 */
export type Forking = {
  readonly parent: MechRow;
  readonly fork: ForkRow;
  readonly sequence: Sequence;
  readonly isCopied: boolean;
};

/** What a fork's decision found: the fork to finish, or the answer that refuses it. */
export type ForkDecision = Result.Result<Forking, Exclude<ForkAnswer, typeof ForkAnswer.cases.Forked.Type>>;

/** The open mech a fork copies. */
export type OpenedInput = { readonly mech: OpenedMech };
