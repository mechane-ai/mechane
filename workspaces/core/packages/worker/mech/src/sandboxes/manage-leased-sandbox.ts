import type { MechRow } from '@mechane/mech-store';
import { SandboxReport, SandboxRequest } from '@mechane/protocol';
import { SandboxAnswer } from '@mechane/rpc';
import type { ObjectSettings, SandboxRpc } from '@mechane/rpc';
import { Option, Result, Schema } from 'effect';
import { admitSandboxMaintenance } from './admit-sandbox-maintenance.ts';

type ManageLeasedSandboxInput = {
  readonly settings: ObjectSettings;
  readonly owner: MechRow;
  readonly stub: SandboxRpc;
  readonly request: SandboxRequest;
};

/** Inspection and cleanup remain available while compute allocation requires an admitted lease. */
export async function manageLeasedSandbox({ ...input }: ManageLeasedSandboxInput): Promise<SandboxAnswer> {
  const refusal = await admitSandboxMaintenance(input);

  if (Option.isSome(refusal)) {
    return refusal.value;
  }

  const request = Schema.encodeSync(SandboxRequest)(input.request);
  const encoded = await input.stub.manage({ request });
  const decoded = Schema.decodeUnknownResult(SandboxReport)(encoded);
  const report = Result.getOrThrow(decoded);

  return SandboxAnswer.cases.Found.make({ report });
}
