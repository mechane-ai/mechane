import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import { SandboxPhase } from '@mechane/protocol';
import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
import { DateTime, Duration, Effect, Option } from 'effect';
import { maintenanceFailure } from './maintenance-failure.ts';
import type { SandboxCallInput } from './types.ts';

const MAINTENANCE_TIMEOUT = Duration.minutes(15);
const MAINTENANCE_POLL = Duration.millis(500);

/** Each retry carries the same operation id; interruption leaves the journal available to resume. */
export const maintainSandbox = Effect.fn('maintainSandbox')(function* ({
  call,
  token,
  workspaceId,
  mechId,
  request,
}: SandboxCallInput): Effect.fn.Return<SandboxReport, RunFailure> {
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, MAINTENANCE_TIMEOUT);
  const operationId = Option.getOrElse(request.operationId, () => 'none');

  announceMaintenance({ operationId: request.operationId });

  for (let observedAt = now; DateTime.isLessThan(observedAt, deadline); observedAt = DateTime.nowUnsafe()) {
    const report = yield* call({
      name: 'manageSandbox',
      input: { ...request, workspaceId, mechId },
      credential: token,
    });

    const reason = maintenanceFailure({ report, request });

    if (Option.isSome(reason)) {
      return yield* new SandboxMaintenanceFailed({ reason: reason.value });
    }

    if (report.phase === SandboxPhase.Done) {
      return report;
    }

    yield* Effect.sleep(MAINTENANCE_POLL);
  }

  return yield* new SandboxMaintenanceFailed({
    reason: `operation ${operationId} is still pending; resume with the same operation id`,
  });
});

type AnnounceMaintenanceInput = Pick<SandboxRequest, 'operationId'>;

function announceMaintenance({ operationId: requested }: AnnounceMaintenanceInput): void {
  const operationId = Option.getOrElse(requested, () => 'none');

  writeDiagnostic({
    program: PROGRAM,
    line: `sandbox operation ${operationId}; resume with --operation-id ${operationId}`,
  });
}
