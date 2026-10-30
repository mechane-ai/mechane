import { Delivery } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { commandGate } from '../mechs/command-gate.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import { signedInWorkspaceMech } from './signed-in-workspace-mech.ts';
import type { QueuedWorkspace } from './types.ts';

/** The item queued behind the suspended workspace's running turn. */
const QUEUED_TEXT = 'Queued before the suspension';

/** Queue preparation closes its follower before the workspace is deliberately suspended. */
export const queueWorkspaceTurns = Effect.fn('queueWorkspaceTurns')(function* ({
  stack,
}: StackInput): Effect.fn.Return<QueuedWorkspace, ScenarioFailure, Scope.Scope> {
  const { mech, workspaceId } = yield* signedInWorkspaceMech({ stack });
  const gate = yield* commandGate({ stack });

  yield* mech.send({ text: `${COMMAND_PREFIX}${gate.bash}`, delivery: Delivery.WhenIdle });
  yield* gate.awaitRun;
  yield* mech.send({ text: QUEUED_TEXT, delivery: Delivery.WhenIdle });

  return { mech, workspaceId, gate };
}, Effect.scoped);
