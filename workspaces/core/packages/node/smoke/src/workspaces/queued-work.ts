import { Delivery, WorkspaceList } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import { commandGate, runCli, signedInMech } from '@mechane/testing';
import type { CommandGate, ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';

/** The item queued behind the suspended workspace's running turn. */
const QUEUED_TEXT = 'Queued before the suspension';

/** The stack a helper works on. */
type StackInput = { readonly stack: Stack };

/** A mech whose turn waits at its gate with an item queued behind it, and the id of the mech's workspace. */
type QueuedWork = { readonly mech: TalkingMech; readonly workspaceId: string; readonly gate: CommandGate };

/** A fresh account's mech whose turn waits at a gate with an item queued behind it, and the account's workspace. */
export const queuedWork = Effect.fn('queuedWork')(function* ({
  stack,
}: StackInput): Effect.fn.Return<QueuedWork, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });

  const workspaces = yield* runCli({
    stack,
    args: ['workspace', 'list'],
    environment: mech.account.environment,
    result: WorkspaceList,
  });

  const gate = yield* commandGate({ stack });

  yield* mech.send({ text: `${COMMAND_PREFIX}${gate.bash}`, delivery: Delivery.WhenIdle });
  yield* gate.awaitRun;
  yield* mech.send({ text: QUEUED_TEXT, delivery: Delivery.WhenIdle });

  return { mech, workspaceId: workspaces.result.workspaces[0].id, gate };
});
