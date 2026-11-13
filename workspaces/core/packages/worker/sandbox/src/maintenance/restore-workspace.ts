import { BackgroundWork } from '@mechane/sandbox-store';
import type { WorkspaceRestore } from '@mechane/sandbox-store';
import { SandboxAction, SandboxPhase, SandboxRestoreRefusalReason, SandboxRestoreResult } from '@mechane/sandbox-wire';
import type { SandboxRestoreRequest } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Equal, Option, Result } from 'effect';
import { maintenanceActive } from './maintenance-active.ts';
import { maintenanceValue } from './maintenance-value.ts';
import { managePortable } from './manage-portable.ts';
import type { PortableMaintenanceInput } from './types.ts';
import { restoreFence } from './workspace-restore-fence.ts';

type RestoreInput = PortableMaintenanceInput & { readonly request: SandboxRestoreRequest };
type RestoreFenceInput = Pick<RestoreInput, 'store' | 'request'>;

/** Positive platform loss permits older saved files, without changing command or final-drain receipts. */
export async function restoreWorkspace({ request, ...input }: RestoreInput): Promise<SandboxRestoreResult> {
  const { store, provider } = input;
  const retained = store.workspaceRestore({ operationId: request.operationId });

  if (Option.isSome(retained)) {
    if (!Equal.equals(retained.value.request, request)) {
      return SandboxRestoreResult.cases.RestoreRefused.make({ reason: SandboxRestoreRefusalReason.OperationReused });
    }

    if (!SandboxRestoreResult.guards.Pending(retained.value.result)) {
      return retained.value.result;
    }

    const current = store.portableMaintenance();

    const isActive = maintenanceActive({ store });

    const ownsMaintenance =
      isActive &&
      Option.exists(current, (job) => job.id === request.operationId && job.action === SandboxAction.Restore);

    if (!ownsMaintenance) {
      return observeRestore({ store, request });
    }

    const operationId = Option.some(request.operationId);

    await managePortable({ ...input, request: { action: SandboxAction.Restore, operationId } });

    return observeRestore({ store, request });
  }

  const initial = restoreFence({ store, request });

  if (Option.isSome(initial)) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: initial.value });
  }

  const latest = store.latestMachine();
  const previous = maintenanceValue({ value: latest, field: 'previous machine' });
  const machines = new Set([request.machineId, previous.id]);
  const probes = Array.from(machines, (machineId) => provider.isAbsent({ machineId }));
  const probing = Promise.all(probes);
  const absent = await capturePromise({ promise: probing });

  if (Result.isFailure(absent)) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: SandboxRestoreRefusalReason.ProviderUnknown });
  }

  if (!absent.success.every(Boolean)) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: SandboxRestoreRefusalReason.ProviderActive });
  }

  const rechecked = restoreFence({ store, request });

  if (Option.isSome(rechecked)) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: rechecked.value });
  }

  const currentLatest = store.latestMachine();

  if (!Option.exists(currentLatest, (machine) => machine.id === previous.id)) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: SandboxRestoreRefusalReason.WorkspaceChanged });
  }

  const state = store.workspace();
  const source = maintenanceValue({ value: state.head, field: 'committed head' });
  const recovery = maintenanceValue({ value: state.recovery, field: 'recovery identity' });
  const result = SandboxRestoreResult.cases.Pending.make({ operationId: request.operationId });

  const record: WorkspaceRestore = {
    request,
    recovery,
    source,
    result,
    previousMachineId: previous.id,
    shouldRetainArtifacts: true,
  };

  const now = DateTime.nowUnsafe();
  const savedSource = Option.some(source);
  const target = Option.none();
  const lastError = Option.none();

  const admitted = store.atomic({
    run: () => {
      // Only confirmed physical absence ends remaining machine-bound work; its uncertainty stays terminal.
      store.loseMachine({ machineId: request.machineId, now });

      if (previous.id !== request.machineId) {
        store.loseMachine({ machineId: previous.id, now });
      }

      const work = store.fileCheckpointWork();

      if (BackgroundWork.guards.Active(work)) {
        return false;
      }

      store.claimWorkspaceRestore(record);
      store.savePortableMaintenance({
        id: request.operationId,
        action: SandboxAction.Restore,
        phase: SandboxPhase.Create,
        provider: input.providerName,
        source: savedSource,
        target,
        lastError,
      });

      return true;
    },
  });

  if (!admitted) {
    return SandboxRestoreResult.cases.RestoreRefused.make({ reason: SandboxRestoreRefusalReason.WorkActive });
  }

  return result;
}

function observeRestore({ store, request }: RestoreFenceInput): SandboxRestoreResult {
  const original = store.workspaceRestore({ operationId: request.operationId });
  const retained = maintenanceValue({ value: original, field: 'restore receipt' });

  if (!SandboxRestoreResult.guards.Pending(retained.result)) {
    return retained.result;
  }

  const current = store.portableMaintenance();
  const matching = Option.filter(current, (job) => job.id === request.operationId);

  if (Option.isSome(matching) && matching.value.action === SandboxAction.Restore && maintenanceActive({ store })) {
    return retained.result;
  }

  const reason = Option.flatMap(matching, (job) => job.lastError);

  const detail = Option.getOrElse(reason, () => 'The restore operation was canceled or superseded');
  const failed = SandboxRestoreResult.cases.Failed.make({ operationId: request.operationId, reason: detail });

  store.finishWorkspaceRestore({ operationId: request.operationId, result: failed });

  return failed;
}
