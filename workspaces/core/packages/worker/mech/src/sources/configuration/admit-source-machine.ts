import { LeaseDecision, MACHINE_LEASE, workspaceStub } from '@mechane/rpc';
import { Duration, Option, Result, Schema } from 'effect';
import type { SourceTaskInput } from '../types.ts';

type LeaseRefusalInput = { readonly decision: LeaseDecision };

/** Real source work reserves capacity only after its grant and state checks; none means admission succeeded. */
export async function admitSourceMachine({ mech, owner }: SourceTaskInput): Promise<Option.Option<string>> {
  const workspace = workspaceStub({ bindings: mech.settings, workspaceId: owner.workspaceId });
  const leaseMs = Duration.toMillis(MACHINE_LEASE);
  const encoded = await workspace.leaseMachine({ sandboxId: owner.id, leaseMs });
  const decoded = Schema.decodeUnknownResult(LeaseDecision)(encoded);

  if (Result.isFailure(decoded)) {
    return Option.some('workspace machine admission is unavailable');
  }

  return leaseRefusal({ decision: decoded.success });
}

function leaseRefusal({ decision }: LeaseRefusalInput): Option.Option<string> {
  if (LeaseDecision.guards.Disabled(decision)) {
    return Option.some('source sandbox is disabled for this workspace');
  }

  if (LeaseDecision.guards.Full(decision)) {
    return Option.some('workspace sandbox machine capacity is full');
  }

  return Option.none();
}
