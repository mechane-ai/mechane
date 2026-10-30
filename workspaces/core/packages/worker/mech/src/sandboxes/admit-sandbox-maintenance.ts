import type { MechRow } from '@mechane/mech-store';
import { SandboxAction } from '@mechane/protocol';
import type { SandboxRequest } from '@mechane/protocol';
import { LeaseDecision, MACHINE_LEASE, SandboxAnswer, workspaceStub } from '@mechane/rpc';
import type { ObjectSettings } from '@mechane/rpc';
import { Duration, Option, Result, Schema } from 'effect';

type AdmitSandboxMaintenanceInput = {
  readonly settings: ObjectSettings;
  readonly owner: MechRow;
  readonly request: SandboxRequest;
};

const MACHINE_ACTIONS: ReadonlySet<SandboxAction> = new Set([
  SandboxAction.Export,
  SandboxAction.Import,
  SandboxAction.Upgrade,
  SandboxAction.Upload,
]);

/** Maintenance that can start a machine shares normal command admission and capacity leases. */
export async function admitSandboxMaintenance({
  settings,
  owner,
  request,
}: AdmitSandboxMaintenanceInput): Promise<Option.Option<SandboxAnswer>> {
  if (!MACHINE_ACTIONS.has(request.action)) {
    return Option.none();
  }

  const { workspaceId } = owner;
  const sandboxId = Option.getOrElse(request.droneId, () => owner.id);
  const workspace = workspaceStub({ bindings: settings, workspaceId });
  const leaseMs = Duration.toMillis(MACHINE_LEASE);
  const encoded = await workspace.leaseMachine({ sandboxId, leaseMs });
  const decoded = Schema.decodeUnknownResult(LeaseDecision)(encoded);
  const decision = Result.getOrThrow(decoded);

  if (LeaseDecision.guards.Disabled(decision)) {
    const answer = SandboxAnswer.cases.Disabled.make({});

    return Option.some(answer);
  }

  if (LeaseDecision.guards.Full(decision)) {
    const answer = SandboxAnswer.cases.CapacityReached.make({});

    return Option.some(answer);
  }

  return Option.none();
}
