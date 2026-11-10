import { StoreConflict } from '@mechane/control-store';
import { toolExecutionId as executionId } from '@mechane/records';
import { SandboxProcessSubmission } from '@mechane/sandbox-wire';
import type { SandboxProcessAnswer } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { ExecutionReceipt } from '../../domain.ts';
import { toolConfiguration, withToolStore } from '../context.ts';
import type { RuntimeToolStore } from '../context.ts';
import { prepareEnvironment } from '../environment.ts';
import { ToolNotStartedError, ToolUnavailableError } from '../errors.ts';
import type { ToolInvocation } from '../types.ts';
import { observeSandboxProcessStart, submitProcess } from './client.ts';
import { processAnswer, ProcessStartReceipt } from './results.ts';
import type { ProcessToolResult } from './results.ts';

export type ProcessInvocation = ToolInvocation & { readonly command: string };
type StartProcessInput = ProcessInvocation & { readonly hasExpired?: () => boolean };
type ProcessAttempt = StartProcessInput & { readonly processId: string; readonly store: RuntimeToolStore };
type ProcessAdmission = Pick<ProcessAttempt, 'workspaceId' | 'mechId' | 'runId' | 'store' | 'hasExpired'>;
type RecordProcess = ProcessAttempt & { readonly result: ProcessToolResult };

const FINAL_RECEIPT_STATES: ReadonlySet<string> = new Set(['completed', 'failed']);
const COMPLETED_PROCESS_STATES: ReadonlySet<string> = new Set(['running', 'exited', 'stopped', 'lost']);

/** Pending machine admission waits durably under the same tool identity instead of asking the model to start again. */
export async function startProcess(input: StartProcessInput): Promise<ProcessToolResult> {
  const processId = await executionId(input);

  try {
    return await withToolStore(async (store) => {
      const attempt = { ...input, processId, store };

      const previous = await store.getExecution({
        id: processId,
        workspaceId: input.workspaceId,
        mechId: input.mechId,
      });

      const replayed = recordedStart({ receipt: previous, command: input.command, processId, runId: input.runId });

      if (replayed !== null) {
        return replayed;
      }

      if (previous !== null) {
        const answer = await observeSandboxProcessStart({ ...attempt, configuration: toolConfiguration() });

        if (!('_tag' in answer) || answer._tag !== 'ExecutionNotFound') {
          const result = processAnswer({ processId, answer });

          if (result.status !== 'pending' || !(await store.canDispatchExecution())) {
            return await recordProcessStart({ ...attempt, result });
          }
        }
      }

      if (!(await canStartProcess(attempt))) {
        throw new ToolNotStartedError('The run no longer permits process admission');
      }

      const begun = await store.beginExecution({
        id: processId,
        runId: input.runId,
        kind: 'process',
        request: { command: input.command },
      });

      const completed = recordedStart({
        receipt: begun.receipt,
        command: input.command,
        processId,
        runId: input.runId,
      });

      if (completed !== null) {
        return completed;
      }

      const answer = await reconcileStart(attempt);
      const result = processAnswer({ processId, answer });

      return await recordProcessStart({ ...attempt, result });
    });
  } catch (error) {
    if (error instanceof ToolNotStartedError) {
      if (input.hasExpired?.() === true) {
        return {
          status: 'uncertain',
          processId,
          message: 'The process admission deadline passed. Inspect its original identity before starting another.',
        };
      }

      return { status: 'refused', processId, message: 'The originating run no longer permits new work.' };
    }

    if (error instanceof StoreConflict) {
      return {
        status: 'refused',
        processId,
        message: 'This process receipt is already bound to another request or outcome.',
      };
    }

    if (error instanceof ToolUnavailableError) {
      return { status: 'unavailable', processId, message: error.message };
    }

    return {
      status: 'uncertain',
      processId,
      message: 'The start could not be confirmed. List processes and inspect this identity before starting another.',
    };
  }
}

async function reconcileStart(input: ProcessAttempt): Promise<SandboxProcessAnswer> {
  const configuration = toolConfiguration();
  const identity = { ...input, configuration };

  if (!(await canStartProcess(input))) {
    throw new ToolNotStartedError('The run no longer permits process admission');
  }

  const submission = Schema.decodeUnknownSync(SandboxProcessSubmission)({
    runId: input.runId,
    toolCallId: input.toolCallId,
    request: { process_id: input.processId, command: input.command },
  });

  const answer = await submitProcess({
    ...identity,
    submission: Schema.encodeSync(SandboxProcessSubmission)(submission),
  });

  if ('_tag' in answer && answer._tag === 'ExecutionEnvironmentRequired') {
    return await authorizeStart(input);
  }

  return answer;
}

async function authorizeStart(input: ProcessAttempt): Promise<SandboxProcessAnswer> {
  if (!(await canStartProcess(input))) {
    throw new ToolNotStartedError('The run no longer permits process dispatch');
  }

  const configuration = toolConfiguration();
  const environment = await prepareEnvironment(input);
  const isAdmitted = await canStartProcess(input);

  if (!isAdmitted) {
    throw new ToolNotStartedError('The run no longer permits process dispatch');
  }

  const submission = Schema.decodeUnknownSync(SandboxProcessSubmission)({
    runId: input.runId,
    toolCallId: input.toolCallId,
    request: { process_id: input.processId, command: input.command, environment },
  });

  return await submitProcess({
    ...input,
    configuration,
    submission: Schema.encodeSync(SandboxProcessSubmission)(submission),
  });
}

async function canStartProcess({ store, workspaceId, mechId, runId, hasExpired }: ProcessAdmission): Promise<boolean> {
  const mech = await store.getMech({ workspaceId, mechId });
  const policy = await store.getRuntimePolicy({ workspaceId });
  const run = await store.getRun({ workspaceId, runId });

  if (policy === null || run === null) {
    return false;
  }

  const isRunActive = run.mechId === mechId && run.status === 'running' && run.cancelRequestedAt === null;
  const isSandboxEnabled = !policy.isSuspended && policy.hasSandboxes && policy.machines > 0;

  const canUseRun = isRunActive && mech.status === 'active' && isSandboxEnabled;

  const isCurrent = canUseRun && (await store.canDispatchExecution());

  return isCurrent && hasExpired?.() !== true;
}

async function recordProcessStart(input: RecordProcess): Promise<ProcessToolResult> {
  const { store, processId, command, result } = input;

  const status: ExecutionReceipt['status'] = (() => {
    if (result.status === 'pending') {
      return 'running';
    }

    if (result.status === 'uncertain') {
      return 'uncertain';
    }

    if (COMPLETED_PROCESS_STATES.has(result.status)) {
      return 'completed';
    }

    return 'failed';
  })();

  try {
    const receipt = await store.finishExecution({
      id: processId,
      providerId: processId,
      status,
      result: { command, outcome: result },
    });

    return ProcessStartReceipt.parse(receipt.result).outcome;
  } catch (error) {
    if (!(error instanceof StoreConflict)) {
      throw error;
    }

    // Another retry may have committed the same start while this one was observing newer log output.
    const receipt = await store.getExecution({ id: processId, workspaceId: input.workspaceId, mechId: input.mechId });
    const committed = recordedStart({ receipt, command, processId, runId: input.runId });

    if (committed === null) {
      throw error;
    }

    return committed;
  }
}

type RecordedStartInput = {
  /** Null means this native tool call has not recorded an execution intent. */
  readonly receipt: ExecutionReceipt | null;
  readonly runId: string;
  readonly command: string;
  readonly processId: string;
};

/** Null leaves admission to the authoritative sandbox journal; a terminal native result never redispatches. */
function recordedStart({ receipt, command, processId, runId }: RecordedStartInput): ProcessToolResult | null {
  if (receipt === null) {
    return null;
  }

  if (receipt.kind !== 'process' || receipt.runId !== runId) {
    return { status: 'refused', processId, message: 'This tool identity belongs to another operation.' };
  }

  if (receipt.request?.['command'] !== command) {
    return { status: 'refused', processId, message: 'This process identity is bound to another command.' };
  }

  if (!FINAL_RECEIPT_STATES.has(receipt.status)) {
    return null;
  }

  const saved = ProcessStartReceipt.parse(receipt.result);

  if (saved.command !== command) {
    return { status: 'refused', processId, message: 'This process identity is bound to another command.' };
  }

  return saved.outcome;
}
