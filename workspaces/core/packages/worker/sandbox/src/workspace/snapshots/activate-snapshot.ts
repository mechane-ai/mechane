import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { WorkspaceRestoration } from '@mechane/sandbox-store';
import { SandboxArchive, StartupFailure, StartupPhase, WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result, Schema } from 'effect';
import type { GuestConnection, WorkspaceProviderStepInput } from '../../types.ts';
import { isInterruptedWorkspaceRequest } from '../is-interrupted-workspace-request.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { isCurrentRestoration } from './current-restoration.ts';

type ActivateSnapshotInput = Pick<WorkspaceProviderStepInput, 'store'> & {
  readonly guest: GuestConnection;
  readonly restoration: WorkspaceRestoration;
  readonly archive: SandboxArchive;
};

/** Polls the generation already owned by the guest until its restored home can accept commands. */
export async function activateSnapshot({
  store,
  guest,
  restoration,
  archive,
}: ActivateSnapshotInput): Promise<boolean> {
  const { machineId, generation } = restoration;
  const observedAt = DateTime.nowUnsafe();

  store.advanceStartup({ machineId, phase: StartupPhase.Restore, now: observedAt });

  const schema = Schema.toType(SandboxArchive);
  const codec = Schema.fromJsonString(schema);
  const body = Schema.encodeSync(codec)(archive);
  const part = Option.none();

  const lease = Option.none();

  const started = performance.now();

  const promise = workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Restore,
    part,
    lease,
    init: { method: HttpMethod.Put, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });

  const activated = await capturePromise({ promise });
  const finished = performance.now();
  const milliseconds = finished - started;

  store.recordStartupWork({ machineId, phase: StartupPhase.Restore, milliseconds });

  // Poll the guest's existing generation again while the startup deadline still owns this restoration.
  if (Result.isFailure(activated) && isInterruptedWorkspaceRequest({ cause: activated.failure })) {
    return false;
  }

  const progress = await guest.startup({ machineId });
  const now = DateTime.nowUnsafe();

  if (Option.isSome(progress)) {
    store.observeGuestStartup({ machineId, guest: progress.value, now });
  }

  if (Result.isFailure(activated)) {
    store.failStartup({ machineId, failure: StartupFailure.Restore, now });
  }

  const response = Result.getOrThrow(activated);

  return response.status === HttpStatusCode.Ok && isCurrentRestoration({ store, restoration });
}
