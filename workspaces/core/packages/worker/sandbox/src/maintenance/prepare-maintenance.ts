import { SANDBOX_ARCHIVE_PART_BYTES, SandboxAction, SandboxPhase } from '@mechane/protocol';
import { WORKSPACE_ARCHIVE_MAX_BYTES } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import { maintenanceValue } from './maintenance-value.ts';
import type { ManagePortableInput } from './types.ts';

/** Refuses maintenance that could discard an unfinished checkpoint or exceed the restore limit. */
export function prepareMaintenance({ store, request }: ManagePortableInput): SandboxPhase {
  const state = store.workspace();

  if (Option.isSome(state.recovery) || Option.isSome(state.checkpoint)) {
    const cause = new PortableMaintenanceRefused({
      reason: 'finish or recover the pending workspace checkpoint before maintenance',
    });

    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  if (request.action === SandboxAction.Import) {
    validateImport({ request });

    return SandboxPhase.Copy;
  }

  if (request.action === SandboxAction.Delete) {
    return SandboxPhase.Retire;
  }

  return SandboxPhase.Quiesce;
}

function validateImport({ request }: Pick<ManagePortableInput, 'request'>): void {
  const supplied = Option.fromNullishOr(request.archive);
  const archive = maintenanceValue({ value: supplied, field: 'archive' });
  const expectedParts = Math.ceil(archive.bytes / SANDBOX_ARCHIVE_PART_BYTES);

  if (archive.bytes > 0 && archive.bytes <= WORKSPACE_ARCHIVE_MAX_BYTES && archive.parts === expectedParts) {
    return;
  }

  const cause = new PortableMaintenanceRefused({
    reason: 'import requires a bounded archive and its exact part count',
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}
