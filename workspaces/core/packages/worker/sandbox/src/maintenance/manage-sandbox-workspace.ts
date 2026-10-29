import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import type { WorkspaceTransferInput } from '../types.ts';
import { managePortable } from './manage-portable.ts';
import { nativeWorkspacePending } from './native-workspace-pending.ts';
import { portableReport } from './portable-report.ts';

type ManageSandboxWorkspaceInput = WorkspaceTransferInput & {
  readonly request: SandboxRequest;
  readonly providerName: string;
};

const IMPORT_ACTIONS: ReadonlySet<SandboxAction> = new Set([SandboxAction.Import, SandboxAction.Upload]);

/** Keeps native files fenced while an explicit import moves them to the configured portable provider. */
export async function manageSandboxWorkspace({ ...input }: ManageSandboxWorkspaceInput): Promise<SandboxReport> {
  const { store, provider, request } = input;
  const portable = store.portableMaintenance();
  const isPortablePending = Option.exists(portable, (job) => job.phase !== SandboxPhase.Done);
  const isImport = IMPORT_ACTIONS.has(request.action);

  if (isPortablePending || isImport) {
    assertPortableTarget(input);

    return await managePortable(input);
  }

  if (nativeWorkspacePending(input)) {
    const report = portableReport(input);

    return { ...report, status: 'import_required', sandboxId: store.remoteSandbox() };
  }

  if (Option.isSome(provider.manage)) {
    return await provider.manage.value(request);
  }

  return await managePortable(input);
}

function assertPortableTarget({ store, provider, providerName }: ManageSandboxWorkspaceInput): void {
  const native = store.maintenance();
  const portable = store.portableMaintenance();
  const isNativePending = Option.exists(native, (job) => job.phase !== SandboxPhase.Done);

  const isOtherTarget = Option.exists(
    portable,
    (job) => job.phase !== SandboxPhase.Done && job.provider !== providerName,
  );

  const isRefused = Option.isSome(provider.manage) || isNativePending || isOtherTarget;

  if (!isRefused) {
    return;
  }

  const cause = new PortableMaintenanceRefused({
    reason: 'finish native maintenance and retain the configured portable provider while importing',
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}
