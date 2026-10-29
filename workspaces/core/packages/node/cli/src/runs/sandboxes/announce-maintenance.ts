import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import type { SandboxRequest } from '@mechane/protocol';
import { Option } from 'effect';

type AnnounceMaintenanceInput = Pick<SandboxRequest, 'operationId'>;

/** Prints the retry identity before any network mutation can be interrupted. */
export function announceMaintenance({ operationId: requested }: AnnounceMaintenanceInput): void {
  const operationId = Option.getOrElse(requested, () => 'none');

  writeDiagnostic({
    program: PROGRAM,
    line: `sandbox operation ${operationId}; resume with --operation-id ${operationId}`,
  });
}
