import { callMech, callWorkspace } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { SlackBinding, SlackBindingResult } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { MechAnswer } from '@mechane/rpc';
import { Effect, Schema } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

type SaveSlackBindingInput = {
  readonly settings: WorkerSettings;
  readonly workspaceId: WorkspaceId;
  readonly binding: SlackBinding;
};

/** Configures one fixed agent and audience, requiring live workspace ownership. */
export const configureSlackBinding = Effect.fn('configureSlackBinding')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.configureSlackBinding>): Effect.fn.Return<
  SlackBindingResult,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId: rawWorkspaceId, ...binding } = input;
  const workspaceId = WorkspaceId.make(rawWorkspaceId);

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  return yield* saveSlackBinding({ settings, workspaceId, binding });
});

const saveSlackBinding = Effect.fn('saveSlackBinding')(function* ({
  settings,
  workspaceId,
  binding,
}: SaveSlackBindingInput): Effect.fn.Return<SlackBindingResult, ObjectUnavailable> {
  const mech = yield* callMech({
    settings,
    workspaceId,
    mechId: binding.mechId,
    call: ({ mech: target }) => target.show(),
    answer: MechAnswer,
  });

  if (MechAnswer.guards.MechMissing(mech)) {
    return SlackBindingResult.cases.Conflicting.make({});
  }

  const encoded = Schema.encodeSync(SlackBinding)(binding);

  return yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.configureSlackBinding({ binding: encoded }),
    answer: SlackBindingResult,
  });
});
