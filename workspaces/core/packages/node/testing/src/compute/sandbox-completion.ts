import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  SANDBOX_COMPLETION_PATH,
  SandboxCheckpointIdentity,
  sandboxCheckpointPath,
  SandboxCheckpointResult,
  SandboxCompletion,
  SandboxCompletionIdentity,
  sandboxCompletionPath,
  SandboxCompletionReceipt,
  SandboxOwner,
} from '@mechane/sandbox-wire';
import type { LocalStack } from '@mechane/stack';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { MechContext } from '../types.ts';

const REQUEST_DEADLINE_MS = 15_000;

type CompletionInput = MechContext & { readonly executionId: string };
type RepeatCompletionInput = MechContext & { readonly receipt: SandboxCompletionReceipt };
type CheckpointInput = MechContext & { readonly operationId?: string };

function sandboxFixture(stack: LocalStack) {
  if (stack.sandbox === undefined) {
    throw new Error('This scenario requires the owned sandbox fixture');
  }

  return stack.sandbox;
}

export async function checkpointSandbox(input: CheckpointInput): Promise<SandboxCheckpointResult> {
  const fixture = sandboxFixture(input.stack);

  const identity = Schema.decodeUnknownSync(SandboxCheckpointIdentity)({
    workspaceId: input.account.workspaceId,
    mechId: input.mechId,
    operationId: input.operationId ?? randomUUID(),
  });

  const response = await fetch(new URL(sandboxCheckpointPath(identity), fixture.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${fixture.bearer}` },
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`The checkpoint request returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(SandboxCheckpointResult)(await response.json());
}

export async function readSandboxCompletion(input: CompletionInput): Promise<SandboxCompletionReceipt | null> {
  const fixture = sandboxFixture(input.stack);

  const identity = Schema.decodeUnknownSync(SandboxCompletionIdentity)({
    workspaceId: input.account.workspaceId,
    mechId: input.mechId,
    executionId: input.executionId,
  });

  const response = await fetch(new URL(sandboxCompletionPath(identity), fixture.origin), {
    headers: { [HttpHeader.Authorization]: `Bearer ${fixture.bearer}` },
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  if (response.status === HttpStatusCode.NotFound) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`The completion read returned ${response.status}`);
  }

  return Schema.decodeUnknownSync(SandboxCompletionReceipt)(await response.json());
}

export async function repeatSandboxCompletion(input: RepeatCompletionInput): Promise<Response> {
  const fixture = sandboxFixture(input.stack);

  const owner = Schema.decodeUnknownSync(SandboxOwner)({
    workspaceId: input.account.workspaceId,
    mechId: input.mechId,
  });

  const body: SandboxCompletion = { ...owner, ...input.receipt };

  return await fetch(new URL(SANDBOX_COMPLETION_PATH, input.stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${fixture.bearer}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify(Schema.encodeSync(SandboxCompletion)(body)),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });
}
