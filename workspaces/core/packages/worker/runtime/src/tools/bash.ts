import type { Mech, WorkspacePolicy } from '@mechane/control-store';
import { HttpMethod, toolExecutionId } from '@mechane/records';
import type { SandboxCapacityRefusalReason, SandboxExecutionResult } from '@mechane/sandbox-wire';
import { Duration, Option } from 'effect';
import type { ExecutionReceipt } from '../domain.ts';
import { writeBashUncertain } from '../output/write-actor-diagnostic.ts';
import { BashResultSchema } from './bash-result.schemas.ts';
import type { BashResult } from './bash-result.schemas.ts';
import { BASH_OBSERVE_WAIT_MS, TOOL_MODEL_RESULT_MAX_BYTES } from './constants.ts';
import type { RuntimeToolStore } from './context.ts';
import { withToolStore } from './context.ts';
import { prepareEnvironment } from './environment.ts';
import { ToolUnavailableError } from './errors.ts';
import { readExecutionReceipt } from './read-execution-receipt.ts';
import { recordBashInput } from './record-bash-input.ts';
import { cancelPendingSandboxExecution, requestSandboxExecution } from './sandbox-client.ts';
import type { BashArguments, BashInvocation, PreparedEnvironment, RuntimeToolContext } from './types.ts';

type ObserveBashInput = RuntimeToolContext & { readonly executionId: string };

type AuthorizeBashInput = ObserveBashInput & {
  readonly store: RuntimeToolStore;
  readonly submission: BashArguments | null;
  readonly wasExecutionCreated: boolean;
  readonly observed: SandboxExecutionResult;
};

type AuthorizedBashBody = {
  readonly environment: PreparedEnvironment;
  readonly waitMs: number;
  readonly command?: string;
  readonly timeoutMs?: number;
};

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);
const NEEDS_ENVIRONMENT: ReadonlySet<string> = new Set(['ExecutionNotFound', 'ExecutionEnvironmentRequired']);
const COMPLETED_COMMAND_STATES: ReadonlySet<string> = new Set(['completed', 'timed_out', 'persistence_failed']);

export async function executeBash(input: BashInvocation): Promise<BashResult> {
  const id = await toolExecutionId(input);

  try {
    return await withToolStore(async (store) => {
      const begun = await store.beginExecution({ id, runId: input.runId, kind: 'sandbox' });

      if (FINAL_RECEIPT_STATES.has(begun.receipt.status)) {
        return BashResultSchema.parse(begun.receipt.result);
      }

      const identity = { ...input, executionId: id };
      const observed = await requestSandboxExecution({ ...identity, method: HttpMethod.Get });

      if (!NEEDS_ENVIRONMENT.has(observed._tag)) {
        const result = bashResult({ executionId: id, progress: observed });

        await recordBashResult({ store, result });

        return result;
      }

      return await authorizeBash({
        ...identity,
        store,
        submission: { command: input.command, timeoutMs: input.timeoutMs },
        wasExecutionCreated: begun.wasCreated && observed._tag === 'ExecutionNotFound',
        observed,
      });
    });
  } catch (error) {
    if (error instanceof ToolUnavailableError) {
      return { status: 'unavailable', executionId: id, message: error.message };
    }

    writeBashUncertain({ executionId: id, cause: error });

    return {
      status: 'uncertain',
      executionId: id,
      message: 'The command’s state could not be confirmed. Use bash_status before issuing another command.',
    };
  }
}

export async function observeBash(input: ObserveBashInput): Promise<BashResult> {
  try {
    return await withToolStore(async (store) => {
      const receipt = await readExecutionReceipt({ ...input, store, kind: 'sandbox' });

      if (receipt === null) {
        return { status: 'refused', executionId: input.executionId, message: 'This mech has no matching execution.' };
      }

      if (FINAL_RECEIPT_STATES.has(receipt.status)) {
        const decoded = BashResultSchema.safeParse(receipt.result);

        if (!decoded.success) {
          return {
            status: 'refused',
            executionId: input.executionId,
            message: 'This execution is not a shell command.',
          };
        }

        return decoded.data;
      }

      const progress = await requestSandboxExecution({ ...input, method: HttpMethod.Get });

      if (progress._tag === 'ExecutionEnvironmentRequired' && receipt.runId === input.runId) {
        return await authorizeBash({
          ...input,
          store,
          submission: null,
          wasExecutionCreated: false,
          observed: progress,
        });
      }

      const result = bashResult({ executionId: input.executionId, progress });

      await recordBashResult({ store, result });

      return result;
    });
  } catch {
    return {
      status: 'uncertain',
      executionId: input.executionId,
      message: 'The execution could not be observed. Check its status again before repeating the command.',
    };
  }
}

async function authorizeBash(input: AuthorizeBashInput): Promise<BashResult> {
  const { store } = input;
  const mech = await store.getMech(input);
  const policy = await store.getRuntimePolicy(input);

  if (!canRunShell({ mech, policy })) {
    return await refuseBeforeDispatch(input, 'Shell execution is not enabled for this mech.');
  }

  const preparedEnvironment = await prepareEnvironment({ ...input, store });
  const run = await store.getRun({ runId: input.runId, workspaceId: input.workspaceId });

  if (run === null || run.cancelRequestedAt !== null || run.status !== 'running') {
    return await refuseBeforeDispatch(input, 'The run is no longer active.');
  }

  if (!(await store.canDispatchExecution())) {
    return await refuseBeforeDispatch(input, 'The tool generation is superseded or execution is fenced.');
  }

  if (input.submission !== null && input.wasExecutionCreated) {
    await recordBashInput({ ...input, command: input.submission.command, secrets: preparedEnvironment.secrets });
  }

  const refusal = await currentBashRefusal(input);

  if (refusal !== null) {
    return await refuseBeforeDispatch(input, refusal);
  }

  const body: AuthorizedBashBody = {
    environment: preparedEnvironment,
    waitMs: BASH_OBSERVE_WAIT_MS,
    ...input.submission,
  };

  const progress = await requestSandboxExecution({
    ...input,
    method: HttpMethod.Post,
    isResume: input.submission === null,
    body: JSON.stringify(body),
  });

  const result = bashResult({ executionId: input.executionId, progress });

  await recordBashResult({ store, result });

  return result;
}

async function currentBashRefusal(input: AuthorizeBashInput): Promise<string | null> {
  const mech = await input.store.getMech(input);
  const policy = await input.store.getRuntimePolicy(input);

  if (!canRunShell({ mech, policy })) {
    return 'Shell execution is not enabled for this mech.';
  }

  const run = await input.store.getRun({ runId: input.runId, workspaceId: input.workspaceId });

  if (run === null || run.status !== 'running' || run.cancelRequestedAt !== null) {
    return 'The run is no longer active.';
  }

  if (!(await input.store.canDispatchExecution())) {
    return 'The tool generation is superseded or execution is fenced.';
  }

  return null;
}

function knownBashOutcome(receipt: ExecutionReceipt): BashResult | null {
  if (receipt.status === 'pending' && receipt.providerId === null && receipt.result === null) {
    return null;
  }

  const decoded = BashResultSchema.safeParse(receipt.result);

  if (decoded.success) {
    return decoded.data;
  }

  return {
    status: 'uncertain',
    executionId: receipt.id,
    message: 'The command’s saved outcome could not be confirmed. Inspect its receipt before repeating it.',
  };
}

async function currentBashReceipt(input: AuthorizeBashInput): Promise<ExecutionReceipt> {
  const receipt = await readExecutionReceipt({ ...input, kind: 'sandbox' });

  if (receipt === null || receipt.runId !== input.runId) {
    throw new Error('The shell execution intent is unavailable');
  }

  return receipt;
}

async function refuseBeforeDispatch(input: AuthorizeBashInput, message: string): Promise<BashResult> {
  const current = await currentBashReceipt(input);
  const known = knownBashOutcome(current);

  const canRefusePending = known === null || known.status === 'running';

  if (canRefusePending && input.observed._tag === 'ExecutionEnvironmentRequired') {
    const progress = await cancelPendingSandboxExecution(input);
    const result = bashResult({ executionId: input.executionId, progress });

    if (progress._tag === 'Unavailable') {
      result.status = 'refused';

      result.message =
        `The command did not run and cannot dispatch later. ${message} ` +
        'Consider the latest notifications and current permissions before issuing a new command if it is still needed.';
    }

    await recordBashResult({ store: input.store, result });

    return result;
  }

  if (known !== null) {
    return known;
  }

  if (input.observed._tag !== 'ExecutionNotFound') {
    return bashResult({ executionId: input.executionId, progress: input.observed });
  }

  const progress = await requestSandboxExecution({ ...input, method: HttpMethod.Get });

  if (progress._tag !== 'ExecutionNotFound') {
    const result = bashResult({ executionId: input.executionId, progress });

    try {
      await recordBashResult({ store: input.store, result });

      return result;
    } catch (error) {
      const retained = knownBashOutcome(await currentBashReceipt(input));

      if (retained !== null) {
        return retained;
      }

      throw error;
    }
  }

  const latest = knownBashOutcome(await currentBashReceipt(input));

  if (latest !== null) {
    return latest;
  }

  if (!input.wasExecutionCreated) {
    return {
      status: 'uncertain',
      executionId: input.executionId,
      message: 'The earlier command has no confirmed remote receipt. Inspect its effects before repeating it.',
    };
  }

  const result: BashResult = { status: 'refused', executionId: input.executionId, message };

  try {
    await input.store.finishExecution({ id: input.executionId, status: 'failed', providerId: null, result });

    return result;
  } catch (error) {
    const retained = knownBashOutcome(await currentBashReceipt(input));

    if (retained !== null) {
      return retained;
    }

    throw error;
  }
}

type ShellAdmissionInput = { readonly mech: Mech; readonly policy: WorkspacePolicy | null };

function canRunShell({ mech, policy }: ShellAdmissionInput): boolean {
  if (policy === null) {
    return false;
  }

  const hasSandboxAccess = !policy.isSuspended && policy.hasSandboxes && policy.machines > 0;

  return mech.status === 'active' && hasSandboxAccess;
}

type BashProgressInput = { readonly executionId: string; readonly progress: SandboxExecutionResult };

function bashResult({ executionId, progress }: BashProgressInput): BashResult {
  switch (progress._tag) {
    case 'Running':
      return { status: 'running', executionId };
    case 'Exited':
      return {
        status: 'completed',
        executionId,
        exitCode: progress.exitCode,
        ...visibleBashOutput(progress.output),
        durationMs: Duration.toMillis(progress.duration),
      };
    case 'TimedOut':
      return {
        status: 'timed_out',
        executionId,
        ...visibleBashOutput(progress.output),
        durationMs: Duration.toMillis(progress.duration),
      };
    case 'PersistenceFailed': {
      const result: BashResult = {
        status: 'persistence_failed',
        executionId,
        ...visibleBashOutput(progress.output),
        durationMs: Duration.toMillis(progress.duration),
        message:
          'The command ran, but its files could not be committed. Inspect the current filesystem before continuing.',
      };

      if (Option.isSome(progress.commandOutcome)) {
        result.commandOutcome = progress.commandOutcome.value;

        if (progress.commandOutcome.value.state === 'exited') {
          result.exitCode = progress.commandOutcome.value.exitCode;
        }
      }

      return result;
    }
    case 'Uncertain':
      return {
        status: 'uncertain',
        executionId,
        message: 'The command may have run. Check its external effects before issuing another command.',
      };
    case 'Unavailable':
      return { status: 'unavailable', executionId, message: 'The sandbox could not start this command.' };
    case 'ExecutionNotFound':
      return { status: 'unavailable', executionId, message: 'This execution was not accepted by the sandbox.' };
    case 'ExecutionEnvironmentRequired':
      return {
        status: 'running',
        executionId,
        message: 'The command is accepted and waiting for its current execution environment.',
      };
    case 'ExecutionReused':
      return {
        status: 'refused',
        executionId,
        message: 'This execution identity is already bound to a different command.',
      };
    case 'CapacityRefused':
      return { status: 'refused', executionId, message: sandboxCapacityMessage(progress.reason) };
  }
}

function sandboxCapacityMessage(reason: SandboxCapacityRefusalReason): string {
  switch (reason) {
    case 'disabled':
      return 'The current workspace policy does not permit a sandbox machine.';
    case 'capacity':
      return 'The workspace machine limit is reached. Stop another mech’s sandbox before starting this one.';
    case 'stale':
      return 'The sandbox allocation changed. Inspect its current state before requesting another command.';
  }
}

type BashOutput = { readonly text: string; readonly omittedBytes: number };

function visibleBashOutput({ text, omittedBytes }: BashOutput) {
  const encoded = new TextEncoder().encode(text);

  if (encoded.byteLength <= TOOL_MODEL_RESULT_MAX_BYTES) {
    return { output: text, omittedBytes, isTruncated: omittedBytes > 0 };
  }

  const output = new TextDecoder().decode(encoded.subarray(0, TOOL_MODEL_RESULT_MAX_BYTES), { stream: true });
  const retainedBytes = new TextEncoder().encode(output).byteLength;

  return {
    output,
    omittedBytes: omittedBytes + encoded.byteLength - retainedBytes,
    isTruncated: true,
    message:
      'The output excerpt is truncated. Use read_tool_result for the retained receipt, or inspect files with bounded shell commands.',
  };
}

type RecordBashResultInput = { readonly store: RuntimeToolStore; readonly result: BashResult };

async function recordBashResult({ store, result }: RecordBashResultInput): Promise<void> {
  if (result.status === 'running') {
    await store.finishExecution({ id: result.executionId, status: 'running', providerId: result.executionId, result });

    return;
  }

  if (result.status === 'uncertain') {
    await store.finishExecution({
      id: result.executionId,
      status: 'uncertain',
      providerId: result.executionId,
      result,
    });

    return;
  }

  if (COMPLETED_COMMAND_STATES.has(result.status)) {
    await store.finishExecution({
      id: result.executionId,
      status: 'completed',
      providerId: result.executionId,
      result,
    });

    return;
  }

  await store.finishExecution({ id: result.executionId, status: 'failed', providerId: result.executionId, result });
}
