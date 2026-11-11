import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { BYTES_PER_KIBIBYTE, HttpMethod } from '@mechane/records';
import {
  SandboxCheckpointIdentity,
  sandboxCheckpointPath,
  SandboxCheckpointResult,
  SandboxReport,
  SandboxServiceIdentity,
  sandboxWorkspacePath,
} from '@mechane/sandbox-wire';
import { Option, Schema } from 'effect';
import { State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { appendEvent } from '../notifications/admission.ts';
import { requestSandboxJson } from '../tools/sandbox-transport.ts';

const CHECKPOINT_RESPONSE_MAX_BYTES = 4 * BYTES_PER_KIBIBYTE;
const WORKSPACE_REPORT_MAX_BYTES = 16 * BYTES_PER_KIBIBYTE;

function checkpointFailureReason(result: SandboxCheckpointResult): string | null {
  switch (result._tag) {
    case 'Failed':
      return result.reason;
    case 'Unallocated':
      return 'The preserved environment has no allocated file owner';
    case 'Pending':
    case 'Committed':
      return null;
  }
}

export async function advanceCheckpoint(access: ActorAccess): Promise<boolean> {
  const operationId = await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);

    if (!state.isEnvironmentCheckpointRequired) {
      return null;
    }

    if (!state.isQuiesced || !state.isResumePending) {
      throw new Error('The environment barrier has no quiesced resume intent');
    }

    state.checkpointBarrier ??= crypto.randomUUID();

    return state.checkpointBarrier;
  }, BACKGROUND_CONTEXT);

  if (operationId === null) {
    return true;
  }

  await access.arm();

  const identity = Schema.decodeUnknownSync(SandboxCheckpointIdentity)({ ...access.scope, operationId });

  const result = Schema.decodeUnknownSync(SandboxCheckpointResult)(
    await requestSandboxJson({
      configuration: access.configuration,
      url: new URL(sandboxCheckpointPath(identity), access.configuration.sandbox.origin),
      method: HttpMethod.Post,
      body: null,
      maximumBytes: CHECKPOINT_RESPONSE_MAX_BYTES,
    }),
  );

  const failureReason = checkpointFailureReason(result);

  if (failureReason !== null) {
    await access.harness.commit(async (transaction) => {
      const state = await transaction.doc(State);

      if (state.checkpointBarrier !== operationId) {
        throw new Error('The environment barrier ownership changed');
      }

      state.isResumePending = false;

      await appendEvent(transaction, {
        type: 'environment.checkpoint_failed',
        runId: null,
        payload: { operationId, reason: failureReason },
      });
    }, BACKGROUND_CONTEXT);

    return false;
  }

  if (result._tag !== 'Committed') {
    return false;
  }

  const scope = Schema.decodeUnknownSync(SandboxServiceIdentity)(access.scope);

  const report = Schema.decodeUnknownSync(SandboxReport)(
    await requestSandboxJson({
      configuration: access.configuration,
      url: new URL(sandboxWorkspacePath(scope), access.configuration.sandbox.origin),
      method: HttpMethod.Get,
      body: null,
      maximumBytes: WORKSPACE_REPORT_MAX_BYTES,
    }),
  );

  if (Option.isNone(report.environment.committedGeneration)) {
    return false;
  }

  // A later automatic generation cannot invalidate this operation's committed file barrier.
  const hasRequiredCheckpoint = Option.exists(
    report.environment.checkpoint,
    (checkpoint) => checkpoint.isAutomatic !== true,
  );

  if (hasRequiredCheckpoint || Option.isSome(report.environment.recovery)) {
    return false;
  }

  await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);

    if (state.checkpointBarrier !== operationId || !state.isQuiesced || !state.isResumePending) {
      throw new Error('The environment barrier ownership changed');
    }

    state.isEnvironmentCheckpointRequired = false;

    await appendEvent(transaction, {
      type: 'environment.checkpointed',
      runId: null,
      payload: { operationId, generation: result.generation },
    });
  }, BACKGROUND_CONTEXT);

  return true;
}
