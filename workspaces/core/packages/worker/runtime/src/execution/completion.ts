import { RequestInvalid } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { SandboxCompletion, sandboxCompletionPath, SandboxCompletionReceipt } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { MechScope } from '../actor/client.ts';
import { Effects, ImportedCompletions } from '../actor/collections.ts';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { stableJson } from '../actor/state.ts';
import { readArchivedCompletion, requireSameReceipt, retainArchivedCompletion } from '../actor/store/completions.ts';
import type { RuntimeConfiguration } from '../config.ts';
import { requestSandboxJson } from '../tools/sandbox-transport.ts';

const COMPLETION_MAX_BYTES = 4096;

type CompletionArchive = {
  readonly scope: MechScope;
  readonly harness: ActorRecordReader;
  readonly configuration: RuntimeConfiguration;
  readonly storage: Pick<DurableObjectStorage, 'get' | 'transaction'>;
};

export async function archiveCompletion(archive: CompletionArchive, completion: SandboxCompletion): Promise<void> {
  if (completion.workspaceId !== archive.scope.workspaceId || completion.mechId !== archive.scope.mechId) {
    throw new RequestInvalid({ reason: 'The completion belongs to another mech' });
  }

  const encoded = Schema.encodeSync(SandboxCompletion)(completion);
  const existing = await readArchivedCompletion(archive.storage, completion.executionId);

  if (existing !== undefined) {
    requireSameReceipt(existing, encoded);

    return;
  }

  const effect = await Effects.get(archive.harness, completion.executionId);
  const imported = await ImportedCompletions.get(archive.harness, completion.executionId);

  if (effect === undefined && imported === undefined) {
    throw new RequestInvalid({ reason: 'The completion has no matching execution receipt' });
  }

  if (effect !== undefined && effect.kind !== completion.kind) {
    throw new RequestInvalid({ reason: 'The completion kind differs from its execution receipt' });
  }

  if (imported !== undefined) {
    requireSameReceipt(imported, encoded);
  }

  const observed = await requestSandboxJson({
    configuration: archive.configuration,
    url: new URL(sandboxCompletionPath(completion), archive.configuration.sandbox.origin),
    method: HttpMethod.Get,
    body: null,
    maximumBytes: COMPLETION_MAX_BYTES,
    expectedStatus: HttpStatusCode.Ok,
  });

  const { workspaceId: _workspaceId, mechId: _mechId, ...reported } = encoded;

  const retained = Schema.encodeSync(SandboxCompletionReceipt)(
    Schema.decodeUnknownSync(SandboxCompletionReceipt)(observed),
  );

  if (stableJson(retained) !== stableJson(reported)) {
    throw new RequestInvalid({ reason: 'The completion differs from its durable environment receipt' });
  }

  await retainArchivedCompletion(archive.storage, encoded);
}
