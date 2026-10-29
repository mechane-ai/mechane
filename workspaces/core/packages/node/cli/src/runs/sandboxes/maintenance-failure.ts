import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
import { Equal, Option } from 'effect';

const UNSUPPORTED_STATUS = 'unsupported';
type MaintenanceFailureInput = { readonly report: SandboxReport; readonly request: SandboxRequest };

/** Rejects stale retry ids and terminal failures before the CLI claims completion. */
export function maintenanceFailure({ report, request }: MaintenanceFailureInput): Option.Option<string> {
  if (
    !Equal.equals(report.operationId, request.operationId) ||
    report.phase === SandboxPhase.Failed ||
    report.status === UNSUPPORTED_STATUS
  ) {
    return Option.some(
      `sandbox reports ${report.status}/${report.phase}; inspect it with sandbox show before resuming or canceling`,
    );
  }

  if (request.action !== SandboxAction.Cancel && !Option.contains(report.action, request.action)) {
    return Option.some('the operation id belongs to a different action');
  }

  return Option.none();
}
