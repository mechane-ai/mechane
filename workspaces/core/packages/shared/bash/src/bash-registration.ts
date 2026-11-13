import type { ExecutionEnv, Result } from '@earendil-works/pi-durable/env';
import { err, FileError } from '@earendil-works/pi-durable/env';
import { createBashTool } from '@earendil-works/pi-durable/tools';

type NativeBash = ReturnType<typeof createBashTool>;
type NativeExecute = NativeBash['execute'];
type ShellExecute = ExecutionEnv['exec'];

type CreateBashRegistrationInput = {
  readonly cwd: string;
  // oxlint-disable-next-line max-params -- Pi shell execution gains the invocation-bound native tool API.
  readonly execute: (
    command: Parameters<ShellExecute>[0],
    options: Parameters<ShellExecute>[1],
    api: Parameters<NativeExecute>[1],
    context: Parameters<ShellExecute>[2],
  ) => ReturnType<ShellExecute>;
};

export function createBashRegistration({ cwd, execute }: CreateBashRegistrationInput): NativeBash {
  const native = createBashTool();

  async function unsupported(): Promise<Result<never, FileError>> {
    return err(new FileError('not_supported', 'Use ordinary shell commands for files'));
  }

  return {
    ...native,
    description:
      'Execute a bash command in the current working directory. Returns combined stdout and stderr with a bounded retained tail. Optional timeout is in seconds. Full output is available only when the executor reports a spill file.',
    execute: async (argumentsValue, api, context) => {
      const environment: ExecutionEnv = {
        id: 'bash',
        cwd,
        absolutePath: unsupported,
        joinPath: unsupported,
        readTextFile: unsupported,
        openTextLineReader: unsupported,
        readTextLines: unsupported,
        readBinaryFile: unsupported,
        openBinaryReader: unsupported,
        writeFile: unsupported,
        appendFile: unsupported,
        truncateFile: unsupported,
        flushFile: unsupported,
        renameFile: unsupported,
        fileInfo: unsupported,
        listDir: unsupported,
        openDirReader: unsupported,
        watch: unsupported,
        canonicalPath: unsupported,
        exists: unsupported,
        createDir: unsupported,
        remove: unsupported,
        createTempDir: unsupported,
        createTempFile: unsupported,
        cleanup: async () => undefined,
        exec: async (command, options, executionContext) => await execute(command, options, api, executionContext),
      };

      return await native.execute(argumentsValue, { ...api, env: environment }, context);
    },
  };
}
