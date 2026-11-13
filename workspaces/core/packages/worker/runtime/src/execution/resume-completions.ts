import { HttpMethod } from '@mechane/records';
import {
  SandboxCompletion,
  SandboxCompletionAccepted,
  SandboxCompletionReceipt,
  SandboxOwner,
  sandboxPendingCompletionsPath,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { ActorAccess } from '../actor/types.ts';
import { requestSandboxJson } from '../tools/sandbox-transport.ts';
import { acceptCompletion } from './completion.ts';

const RESUME_COMPLETIONS_TIMEOUT_MS = 15_000;
const RESUME_COMPLETIONS_MAX_BYTES = 32_768;
const CompletionReceipts = Schema.Array(SandboxCompletionReceipt);
const SandboxPendingCompletions = Schema.Struct({ receipts: CompletionReceipts });

export async function reconcileResumeCompletions(access: ActorAccess): Promise<boolean> {
  const owner = Schema.decodeUnknownSync(SandboxOwner)(access.scope);
  const url = new URL(sandboxPendingCompletionsPath(owner), access.configuration.sandbox.origin);
  const signal = AbortSignal.timeout(RESUME_COMPLETIONS_TIMEOUT_MS);
  const request = { configuration: access.configuration, url, maximumBytes: RESUME_COMPLETIONS_MAX_BYTES, signal };

  async function read() {
    const response = await requestSandboxJson({ ...request, method: HttpMethod.Get, body: null });

    return Schema.decodeUnknownSync(SandboxPendingCompletions)(response).receipts;
  }

  const receipts = await read();

  for (const receipt of receipts) {
    const completion = Schema.decodeUnknownSync(SandboxCompletion)({
      ...owner,
      ...Schema.encodeSync(SandboxCompletionReceipt)(receipt),
    });

    await acceptCompletion(access, completion, { isResumeCompletion: true, signal });
    Schema.decodeUnknownSync(SandboxCompletionAccepted)(
      await requestSandboxJson({
        ...request,
        method: HttpMethod.Post,
        body: JSON.stringify(Schema.encodeSync(SandboxCompletionReceipt)(receipt)),
      }),
    );
  }

  const remaining = await read();

  return remaining.length === 0;
}
