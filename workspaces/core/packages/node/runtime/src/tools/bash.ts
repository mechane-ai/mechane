import { HttpMethod } from '@mechane/records';
import { EXECUTION_TIMEOUT_MAX } from '@mechane/sandbox-wire';
import type { SandboxCapacityRefusalReason, SandboxExecutionResult } from '@mechane/sandbox-wire';
import { Duration } from 'effect';
import { sleep } from 'workflow';
import { z } from 'zod';
import { loadRuntimeConfiguration } from '../config.ts';
import type { Mech } from '../domain.ts';
import type { WorkspacePolicy } from '../store/api/configuration/types.ts';
import type { RuntimeStore } from '../store/database.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { BASH_OBSERVE_WAIT_MS, BASH_POLL_INTERVAL_MS, TOOL_MODEL_RESULT_MAX_BYTES } from './constants.ts';
import { prepareEnvironment } from './environment.ts';
import { ToolUnavailableError } from './errors.ts';
import { executionId as toolExecutionId } from './execution-id.ts';
import { revokeGitHubToken } from './github-token.ts';
import { requestSandboxExecution } from './sandbox-client.ts';
import type { BashArguments, BashInvocation, PreparedEnvironment, RuntimeToolContext } from './types.ts';

const BashResultSchema = z.object({
  status: z.enum(['running', 'completed', 'timed_out', 'uncertain', 'unavailable', 'persistence_failed', 'refused']),
  executionId: z.string(),
  output: z.string().optional(),
  omittedBytes: z.number().int().nonnegative().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
  isTruncated: z.boolean().optional(),
});

export type BashResult = z.infer<typeof BashResultSchema>;

type ObserveBashInput = RuntimeToolContext & { readonly executionId: string };

type AuthorizeBashInput = ObserveBashInput & {
  readonly store: RuntimeStore;
  readonly submission: BashArguments | null;
};

type AuthorizedBashBody = {
  readonly environment: PreparedEnvironment['environment'];
  readonly waitMs: number;
  readonly command?: string;
  readonly timeoutMs?: number;
};

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);
const NEEDS_ENVIRONMENT: ReadonlySet<string> = new Set(['ExecutionNotFound', 'ExecutionEnvironmentRequired']);
const TOKEN_MUST_EXPIRE: ReadonlySet<string> = new Set(['running', 'uncertain']);
const COMPLETED_COMMAND_STATES: ReadonlySet<string> = new Set(['completed', 'timed_out', 'persistence_failed']);

export async function executeBash(input: BashInvocation): Promise<BashResult> {
  const first = await submitBash(input);

  if (first.status !== 'running') {
    return first;
  }

  const observations = Math.ceil(input.timeoutMs / BASH_OBSERVE_WAIT_MS);

  for (let attempt = 0; attempt < observations; attempt += 1) {
    await sleep(BASH_POLL_INTERVAL_MS);

    const result = await submitBash(input);

    if (result.status !== 'running') {
      return result;
    }
  }

  return {
    ...first,
    message: 'The command is still running. Use bash_status to observe this execution without repeating it.',
  };
}

async function submitBash(input: BashInvocation): Promise<BashResult> {
  'use step';

  const id = await toolExecutionId(input);

  try {
    return await withRuntimeStore(async (store) => {
      const mech = await store.getMech(input);
      const policy = await store.getRuntimePolicy(input);

      if (!canRunShell({ mech, policy })) {
        return { status: 'refused', executionId: id, message: 'Shell execution is not enabled for this mech.' };
      }

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
      });
    });
  } catch (error) {
    if (error instanceof ToolUnavailableError) {
      return { status: 'unavailable', executionId: id, message: error.message };
    }

    return {
      status: 'uncertain',
      executionId: id,
      message: 'The command’s state could not be confirmed. Use bash_status before issuing another command.',
    };
  }
}

export async function observeBash(input: ObserveBashInput): Promise<BashResult> {
  'use step';

  try {
    return await withRuntimeStore(async (store) => {
      const receipt = await store.getExecution({
        id: input.executionId,
        workspaceId: input.workspaceId,
        mechId: input.mechId,
      });

      if (receipt === null || receipt.kind !== 'sandbox') {
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
        return await authorizeBash({ ...input, store, submission: null });
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
    return {
      status: 'refused',
      executionId: input.executionId,
      message: 'Shell execution is not enabled for this mech.',
    };
  }

  const configuration = loadRuntimeConfiguration();
  const prepared = await prepareEnvironment({ ...input, store });

  async function revokeUnsubmittedToken(error: unknown): Promise<never> {
    if (prepared.githubToken !== null) {
      try {
        await revokeGitHubToken({ origin: configuration.githubApiOrigin, token: prepared.githubToken });
      } catch (revocationError) {
        throw new AggregateError([error, revocationError], 'Cannot release the unsubmitted execution credential', {
          cause: revocationError,
        });
      }
    }

    throw error;
  }

  const run = await store.getRun({ runId: input.runId, workspaceId: input.workspaceId }).catch(revokeUnsubmittedToken);

  if (run === null || run.cancelRequestedAt !== null || run.status !== 'running') {
    if (prepared.githubToken !== null) {
      await revokeGitHubToken({ origin: configuration.githubApiOrigin, token: prepared.githubToken });
    }

    return { status: 'refused', executionId: input.executionId, message: 'The run is no longer active.' };
  }

  const body: AuthorizedBashBody = {
    environment: prepared.environment,
    waitMs: BASH_OBSERVE_WAIT_MS,
    ...input.submission,
  };

  const progress = await requestSandboxExecution({
    ...input,
    method: HttpMethod.Post,
    isResume: input.submission === null,
    body: JSON.stringify(body),
  });

  const confirmed = await observeAuthorizedExecution({ input, progress, prepared });
  const result = bashResult({ executionId: input.executionId, progress: confirmed });

  if (prepared.githubToken !== null && !TOKEN_MUST_EXPIRE.has(result.status)) {
    try {
      await revokeGitHubToken({ origin: configuration.githubApiOrigin, token: prepared.githubToken });
    } catch {
      result.message =
        'The execution finished, but its temporary GitHub token could not be revoked. The token expires automatically.';
    }
  }

  await recordBashResult({ store, result });

  return result;
}

type ObserveAuthorizedInput = {
  readonly input: AuthorizeBashInput;
  readonly progress: SandboxExecutionResult;
  readonly prepared: PreparedEnvironment;
};

type ShellAdmissionInput = { readonly mech: Mech; readonly policy: WorkspacePolicy | null };

function canRunShell({ mech, policy }: ShellAdmissionInput): boolean {
  if (policy === null) {
    return false;
  }

  const hasSandboxAccess = !policy.isSuspended && policy.hasSandboxes && policy.machines > 0;

  return mech.status === 'active' && hasSandboxAccess;
}

async function observeAuthorizedExecution({
  input,
  progress,
  prepared,
}: ObserveAuthorizedInput): Promise<SandboxExecutionResult> {
  if (prepared.githubToken === null || progress._tag !== 'Running') {
    return progress;
  }

  const timeoutMs = input.submission?.timeoutMs ?? Duration.toMillis(EXECUTION_TIMEOUT_MAX);
  const deadlineMs = performance.now() + timeoutMs;
  const observed: { progress: SandboxExecutionResult } = { progress };

  while (observed.progress._tag === 'Running' && performance.now() < deadlineMs) {
    observed.progress = await requestSandboxExecution({ ...input, method: HttpMethod.Get });
  }

  return observed.progress;
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
    case 'PersistenceFailed':
      return {
        status: 'persistence_failed',
        executionId,
        ...visibleBashOutput(progress.output),
        durationMs: Duration.toMillis(progress.duration),
        message:
          'The command ran, but its files could not be committed. Inspect the current filesystem before continuing.',
      };
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

type RecordBashResultInput = { readonly store: RuntimeStore; readonly result: BashResult };

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
