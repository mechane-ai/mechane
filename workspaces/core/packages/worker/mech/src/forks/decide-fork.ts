import type { ForkRow, MechTables } from '@mechane/mech-store';
import { ForkAnswer } from '@mechane/rpc';
import type { ForkInput } from '@mechane/rpc';
import { Option, Result } from 'effect';
import type { NowInput, TablesInput } from '../types.ts';
import type { ForkDecision } from './types.ts';

/** A fork call, decided in one transaction at the time of the call. */
type ForkDecisionInput = ForkInput & TablesInput & NowInput;

/** The tables whose running state an idle mech holds none of. */
type IdleInput = { readonly store: MechTables };

/**
 * Decides a fork in one transaction: a fork the mech began and never ended is the one this call finishes, under its
 * first id, name, requester and time. Once its copy ended, the fork copies from the point that copy holds. Without an
 * ended copy, only an idle mech forks, from the point it is at now, finishing its open fork or recording a new one.
 */
export function decideFork({ store, forkId, name, requesterId, now }: ForkDecisionInput): ForkDecision {
  const parent = store.mech();

  if (Option.isNone(parent)) {
    return Result.fail(ForkAnswer.cases.MechMissing.make({}));
  }

  const open = store.openFork();
  const copied = Option.flatMap(open, ({ sequence }) => sequence);

  if (Option.isSome(open) && Option.isSome(copied)) {
    return Result.succeed({ parent: parent.value, fork: open.value, sequence: copied.value, isCopied: true });
  }

  if (!isIdle({ store })) {
    return Result.fail(ForkAnswer.cases.Busy.make({}));
  }

  const started: ForkRow = { id: forkId, name, requesterId, startedAt: now, sequence: Option.none() };
  const fork = Option.getOrElse(open, () => started);

  store.recordFork({ fork });

  return Result.succeed({ parent: parent.value, fork, sequence: store.lastSequence(), isCopied: false });
}

/**
 * Whether the mech holds no running state for a copy to miss. No turn runs or owes its note, no item waits for a turn
 * or holds a running one, and no drone runs or has a machine to stop. A memory change waits only for its running turn.
 */
function isIdle({ store }: IdleInput): boolean {
  const owed = [store.owedNotes(), store.pendingInboxItems(), store.runningDrones(), store.unstoppedDrones()];

  return Option.isNone(store.runningTurn()) && owed.every((running) => running.length === 0);
}
