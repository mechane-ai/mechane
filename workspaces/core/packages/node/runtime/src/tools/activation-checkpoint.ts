import { HttpMethod } from '@mechane/records';
import { SandboxCheckpointIdentity, sandboxCheckpointPath, SandboxCheckpointResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { sleep } from 'workflow';
import { loadRuntimeConfiguration } from '../config.ts';
import { executionId } from '../execution-id.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { TOOL_RESPONSE_MAX_BYTES } from './constants.ts';
import { requestSandboxJson } from './sandbox-transport.ts';

const CHECKPOINT_POLL_INTERVAL_MS = 1000;
const CHECKPOINT_MAX_POLLS = 300;

type ActivationCheckpoint = { readonly runId: string; readonly checkpointSequence: number };
type CheckpointIdentity = typeof SandboxCheckpointIdentity.Encoded;

/** Context handoff waits for committed files, while managed processes resume after the snapshot. */
export async function checkpointActivation(input: ActivationCheckpoint): Promise<void> {
  const identity = await prepareActivationCheckpoint(input);

  for (let attempt = 0; attempt < CHECKPOINT_MAX_POLLS; attempt += 1) {
    const result = await advanceActivationCheckpoint(identity);

    switch (result._tag) {
      case 'Committed':
      case 'Unallocated':
        return;
      case 'Failed':
        throw new Error(`The activation could not save its environment: ${result.reason}`);
      case 'Pending':
        await sleep(CHECKPOINT_POLL_INTERVAL_MS);
    }
  }

  throw new Error('The activation environment checkpoint did not settle before its deadline.');
}

async function prepareActivationCheckpoint(input: ActivationCheckpoint): Promise<CheckpointIdentity> {
  'use step';

  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId: input.runId });

    if (run === null) {
      throw new Error('The activation no longer exists.');
    }

    const operationId = await executionId({
      runId: input.runId,
      toolCallId: `environment-checkpoint:${input.checkpointSequence}`,
    });

    return { workspaceId: run.workspaceId, mechId: run.mechId, operationId };
  });
}

async function advanceActivationCheckpoint(input: CheckpointIdentity): Promise<SandboxCheckpointResult> {
  'use step';

  const configuration = loadRuntimeConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxCheckpointIdentity)(input);
  const url = new URL(sandboxCheckpointPath(identity), configuration.sandbox.origin);

  const result = await requestSandboxJson({
    configuration,
    url,
    method: HttpMethod.Post,
    body: null,
    maximumBytes: TOOL_RESPONSE_MAX_BYTES,
  });

  return Schema.decodeUnknownSync(SandboxCheckpointResult)(result);
}
