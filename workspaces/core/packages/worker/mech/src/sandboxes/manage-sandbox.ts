import { SandboxAction, SandboxReport, SandboxRequest } from '@mechane/protocol';
import { SandboxAnswer, sandboxStub } from '@mechane/rpc';
import type { SandboxRpc } from '@mechane/rpc';
import { Equal, Option, Result, Schema } from 'effect';
import type { OpenedMech } from '../types.ts';
import { SandboxAccess } from './constants.ts';
import { sandboxAccess } from './sandbox-access.ts';

type ManageSandboxInput = { readonly mech: OpenedMech; readonly request: SandboxRequest };

type ResumeAllowedInput = {
  readonly stub: SandboxRpc;
  readonly request: SandboxRequest;
  readonly access: SandboxAccess;
};

/** The object's input gate keeps the owner idle until the sandbox has durably fenced new executions. */
export async function manageSandbox({ mech, request }: ManageSandboxInput): Promise<SandboxAnswer> {
  const parent = await mech.store.atomic({ run: (store) => store.mech() });

  if (Option.isNone(parent)) {
    return SandboxAnswer.cases.MechMissing.make({});
  }

  const access = await sandboxAccess({ mech, request });

  if (access === SandboxAccess.Missing && Option.isSome(request.droneId)) {
    return SandboxAnswer.cases.DroneMissing.make({ droneId: request.droneId.value });
  }

  const stub = sandboxStub({
    bindings: mech.settings,
    workspaceId: parent.value.workspaceId,
    mechId: parent.value.id,
    droneId: request.droneId,
  });

  const isAllowed = await resumeAllowed({ stub, request, access });

  if (!isAllowed) {
    return SandboxAnswer.cases.Busy.make({});
  }

  const input = Schema.encodeSync(SandboxRequest)(request);
  const encoded = await stub.manage({ request: input });
  const decoded = Schema.decodeUnknownResult(SandboxReport)(encoded);
  const report = Result.getOrThrow(decoded);

  return SandboxAnswer.cases.Found.make({ report });
}

async function resumeAllowed({ stub, request, access }: ResumeAllowedInput): Promise<boolean> {
  if (access === SandboxAccess.Ready) {
    return true;
  }

  if (Option.isNone(request.operationId)) {
    return false;
  }

  const inspection = Schema.encodeSync(SandboxRequest)({ ...request, action: SandboxAction.Show });
  const encoded = await stub.manage({ request: inspection });
  const decoded = Schema.decodeUnknownResult(SandboxReport)(encoded);
  const current = Result.getOrThrow(decoded);

  return Equal.equals(current.operationId, request.operationId);
}
