import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { OperationCall } from '@mechane/client';
import { SandboxRestoreResult } from '@mechane/protocol';
import type { Mech, SandboxRestoreRequest, Workspace } from '@mechane/protocol';
import { DateTime, Effect, Option } from 'effect';
import type { Redacted } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { announceMaintenance } from './announce-maintenance.ts';
import { MAINTENANCE_POLL, MAINTENANCE_TIMEOUT } from './constants.ts';

type RestoreCall = {
  readonly call: OperationCall<'restoreSandbox'>;
  readonly token: Redacted.Redacted;
  readonly workspaceId: Workspace['id'];
  readonly mechId: Mech['id'];
  readonly request: SandboxRestoreRequest;
};

type Restored = typeof SandboxRestoreResult.cases.Restored.Type;

export const runSandboxRestore = Effect.fn('runSandboxRestore')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'sandbox restore'>): Effect.fn.Return<CommandResult<'sandbox restore'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => restore({ call, token, workspaceId, mechId: input.mechId, request: input }),
  });

  return {
    lines: [`Restored saved generation ${result.generation} on ${result.machineId}; unsaved files were not captured`],
    result,
  };
});

const restore = Effect.fn('restore')(function* ({
  call,
  token,
  workspaceId,
  mechId,
  request,
}: RestoreCall): Effect.fn.Return<Restored, RunFailure> {
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, MAINTENANCE_TIMEOUT);

  const operationId = Option.some(request.operationId);

  announceMaintenance({ operationId });

  for (let observedAt = now; DateTime.isLessThan(observedAt, deadline); observedAt = DateTime.nowUnsafe()) {
    const result = yield* call({
      name: 'restoreSandbox',
      credential: token,
      input: { ...request, workspaceId, mechId },
    });

    if (SandboxRestoreResult.guards.Restored(result)) {
      return result;
    }

    if (SandboxRestoreResult.guards.Failed(result) || SandboxRestoreResult.guards.RestoreRefused(result)) {
      return yield* new SandboxMaintenanceFailed({ reason: result.reason });
    }

    yield* Effect.sleep(MAINTENANCE_POLL);
  }

  return yield* new SandboxMaintenanceFailed({
    reason: `operation ${request.operationId} is still pending; retry the same operation id and fences`,
  });
});
