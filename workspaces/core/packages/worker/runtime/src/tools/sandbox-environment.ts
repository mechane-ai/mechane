import type { Context } from '@earendil-works/chord/context';
import { err, ExecutionError, FileError, ok } from '@earendil-works/pi-durable/env';
import type { ExecutionEnv, Result, ShellExecOptions, ShellExecResult } from '@earendil-works/pi-durable/env';
import type { BashResult } from './bash.ts';
import type { BashInvocation, ToolInvocation } from './types.ts';

const SHELL_TIMEOUT_DEFAULT_SECONDS = 120;
const MILLISECONDS_PER_SECOND = 1000;
const SHELL_TIMEOUT_MAX_MS = 600_000;

async function unsupportedFileOperation(): Promise<Result<never, FileError>> {
  return err(new FileError('not_supported', 'This environment exposes files through ordinary shell commands'));
}

export function createSandboxEnvironment(input: {
  readonly invocation: () => ToolInvocation;
  readonly execute: (input: BashInvocation, context: Context) => Promise<BashResult>;
}): ExecutionEnv {
  return {
    id: 'mechane-sandbox',
    cwd: '/home/node',
    absolutePath: unsupportedFileOperation,
    joinPath: unsupportedFileOperation,
    readTextFile: unsupportedFileOperation,
    openTextLineReader: unsupportedFileOperation,
    readTextLines: unsupportedFileOperation,
    readBinaryFile: unsupportedFileOperation,
    openBinaryReader: unsupportedFileOperation,
    writeFile: unsupportedFileOperation,
    appendFile: unsupportedFileOperation,
    truncateFile: unsupportedFileOperation,
    flushFile: unsupportedFileOperation,
    renameFile: unsupportedFileOperation,
    fileInfo: unsupportedFileOperation,
    listDir: unsupportedFileOperation,
    openDirReader: unsupportedFileOperation,
    watch: unsupportedFileOperation,
    canonicalPath: unsupportedFileOperation,
    exists: unsupportedFileOperation,
    createDir: unsupportedFileOperation,
    remove: unsupportedFileOperation,
    createTempDir: unsupportedFileOperation,
    createTempFile: unsupportedFileOperation,
    cleanup: async () => undefined,
    exec: async (
      command: string | ReadonlyArray<string>,
      options: ShellExecOptions | undefined,
      context: Context,
    ): Promise<Result<ShellExecResult, ExecutionError>> => {
      if (typeof command !== 'string') {
        return err(new ExecutionError('spawn_error', 'This environment accepts shell commands'));
      }

      const timeoutMs = Math.min(
        Math.max(1, Math.floor((options?.timeout ?? SHELL_TIMEOUT_DEFAULT_SECONDS) * MILLISECONDS_PER_SECOND)),
        SHELL_TIMEOUT_MAX_MS,
      );

      const result = await input.execute({ ...input.invocation(), command, timeoutMs }, context);
      const output = JSON.stringify(result);

      options?.onOutput?.(output, context, { stream: 'stdout' });

      if (result.status === 'completed') {
        return ok({ exitCode: result.exitCode ?? 0 });
      }

      if (result.status === 'timed_out') {
        return err(new ExecutionError('timeout', `Execution ${result.executionId} timed out`));
      }

      return err(
        new ExecutionError(
          'unknown',
          `Execution ${result.executionId}: ${result.status}. Inspect its receipt before repeating it`,
        ),
      );
    },
  };
}
