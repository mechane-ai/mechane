import type { Context } from '@earendil-works/chord/context';
import type { ToolExecutionApi } from '@earendil-works/pi-durable';
import { err, ExecutionError, ok } from '@earendil-works/pi-durable/env';
import type { ExecutionEnv } from '@earendil-works/pi-durable/env';
import type { BashResult } from './bash-result.schemas.ts';
import type { BashInvocation, ToolInvocation } from './types.ts';

const SHELL_TIMEOUT_DEFAULT_SECONDS = 120;
const MILLISECONDS_PER_SECOND = 1000;
const SHELL_TIMEOUT_MAX_MS = 600_000;

type ExecuteSandboxShellInput = {
  readonly command: Parameters<ExecutionEnv['exec']>[0];
  readonly options: Parameters<ExecutionEnv['exec']>[1];
  readonly context: Context;
  readonly api: ToolExecutionApi;
  readonly invocation: ToolInvocation;
  readonly execute: (input: BashInvocation, context: Context) => Promise<BashResult>;
};

export async function executeSandboxShell(input: ExecuteSandboxShellInput): ReturnType<ExecutionEnv['exec']> {
  const { command, options, context, api } = input;

  if (typeof command !== 'string') {
    return err(new ExecutionError('spawn_error', 'This environment accepts shell commands'));
  }

  const timeoutMs = Math.floor((options?.timeout ?? SHELL_TIMEOUT_DEFAULT_SECONDS) * MILLISECONDS_PER_SECOND);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > SHELL_TIMEOUT_MAX_MS) {
    return err(new ExecutionError('spawn_error', 'The command timeout must be between 0.001 and 600 seconds'));
  }

  const result = await input.execute({ ...input.invocation, command, timeoutMs }, context);

  if (result.output !== undefined) {
    options?.onOutput?.(result.output, context, { stream: 'stdout' });
  }

  if (result.isTruncated === true) {
    api.diagnostic({
      severity: 'warn',
      code: 'execution_output_truncated',
      message: `The execution receipt omitted ${result.omittedBytes} output bytes. Inspect files with bounded shell commands.`,
    });
  }

  if (result.status === 'completed') {
    return ok({ exitCode: result.exitCode });
  }

  if (result.status === 'timed_out' || result.commandOutcome?.state === 'timed_out') {
    return err(new ExecutionError('timeout', `Execution ${result.executionId} timed out`));
  }

  if (result.status === 'persistence_failed') {
    return err(new ExecutionError('unknown', `Execution ${result.executionId}: ${result.message}`));
  }

  return err(
    new ExecutionError(
      'unknown',
      `Execution ${result.executionId}: ${result.status}. ${result.message ?? 'Inspect its receipt before repeating it'}`,
    ),
  );
}
