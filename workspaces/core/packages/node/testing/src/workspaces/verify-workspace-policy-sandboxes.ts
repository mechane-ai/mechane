import { EventType } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { check } from '../check.ts';
import { refuseUnlistedMaintenance } from '../sandboxes/refuse-unlisted-maintenance.ts';
import { refuseUnadmittedSource } from '../sources/refuse-unadmitted-source.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';
import { changeWorkspacePolicy } from './change-workspace-policy.ts';
import { signedInWorkspaceMech } from './signed-in-workspace-mech.ts';
import { verifySandboxCapacity } from './verify-sandbox-capacity.ts';

const DISABLED_OUTPUT = 'a-machine-ran';
const NO_SANDBOX_REPLY = 'This workspace has no sandbox';
type VerifyWorkspacePolicySandboxesInput = StackInput & { readonly administrator: Account };

/** Removing sandbox access must block command, source and maintenance entry points before machine allocation. */
export const verifyWorkspacePolicySandboxes = Effect.fn('verifyWorkspacePolicySandboxes')(function* ({
  stack,
  administrator,
}: VerifyWorkspacePolicySandboxesInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  yield* verifySandboxCapacity({ stack, administrator });

  const { mech, workspaceId } = yield* signedInWorkspaceMech({ stack });

  yield* changeWorkspacePolicy({ stack, administrator, workspaceId, changes: { hasSandboxes: false } });

  const { ended } = yield* mech.turn({ text: `${COMMAND_PREFIX}echo ${DISABLED_OUTPUT}` });
  const isRefused = ended.type === EventType.TurnAnswered && ended.reply.includes(NO_SANDBOX_REPLY);

  yield* refuseUnadmittedSource({ stack, mech });
  yield* refuseUnlistedMaintenance({ stack, mech });
  yield* check({
    name: 'workspace policy refuses sandbox commands before machine allocation',
    conditions: [isRefused],
    detail: `disabled workspace command refusal ${isRefused}`,
  });
});
