import type { MechTables } from '@mechane/mech-store';
import type { ForkInput } from '@mechane/rpc';
import { ForkAnswer, MechAnswer, MechRecord, mechStub, MechSummaryRecord, workspaceStub } from '@mechane/rpc';
import { DateTime, Result, Schema } from 'effect';
import { copyFork } from './copy-fork.ts';
import { decideFork } from './decide-fork.ts';
import { forkedDefinition } from './forked-definition.ts';
import type { ForkDecision, Forking, OpenedInput } from './types.ts';

/** A fork to make of the open mech. */
type ForkMechInput = ForkInput & OpenedInput;

/** The open mech, and the fork it finishes. */
type FinishForkInput = OpenedInput & Forking;

/**
 * Forks the open mech; its object runs this while no other event of it runs, so the copy reads one point of the mech's
 * life. A mech that is missing or busy is refused. The fork of an idle one, or the retry of one cut off, is finished
 * from the step it reached.
 */
export async function forkMech({ mech, ...input }: ForkMechInput): Promise<ForkAnswer> {
  const now = DateTime.nowUnsafe();
  const decide: (tables: MechTables) => ForkDecision = (tables) => decideFork({ store: tables, ...input, now });
  const decision = await mech.store.atomic({ run: decide });

  if (Result.isFailure(decision)) {
    return decision.failure;
  }

  return await finishFork({ mech, ...decision.success });
}

/**
 * Copies the mech into the new mech's object unless the new mech holds the copy already, indexes the new mech in the
 * workspace, and only then ends the fork. A fork cut off at any step is the one the next fork call finishes. A copy the
 * new mech holds is never made again, since the new mech may have worked since.
 */
async function finishFork({ mech, parent, fork, sequence, isCopied }: FinishForkInput): Promise<ForkAnswer> {
  const id = fork.id;
  const forkedFrom = { mechId: parent.id, sequence };
  const forked = forkedDefinition({ parent, fork, sequence });

  if (!isCopied) {
    await copyFork({
      mech,
      forked: { ...Schema.encodeSync(MechRecord)(forked), workspaceId: parent.workspaceId, forkedFrom },
    });
  }

  // A retry reads the completed copy: the parent or fork may have changed since the copy finished.
  const destination = mechStub({ bindings: mech.settings, workspaceId: parent.workspaceId, mechId: id });
  const reading = await destination.show();
  const answer = await Schema.decodeUnknownPromise(MechAnswer.cases.Found)(reading);
  const copied = answer.mech;

  await workspaceStub({ bindings: mech.settings, workspaceId: parent.workspaceId }).indexMech({
    mech: Schema.encodeSync(MechSummaryRecord)(copied),
  });

  const now = DateTime.nowUnsafe();
  const end: (tables: MechTables) => void = (tables) => tables.endFork({ forkId: id, now });

  await mech.store.atomic({ run: end });

  return ForkAnswer.cases.Forked.make({ mech: copied });
}
