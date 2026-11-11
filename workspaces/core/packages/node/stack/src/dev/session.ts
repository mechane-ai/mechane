import { Schema } from 'effect';
import { access, readFile, rm, rmdir } from 'node:fs/promises';
import { freeLocalOrigin } from '../local-origin.ts';
import { resetLocalState } from '../reset-local-state.ts';
import { runStackProgram } from '../run-stack-program.ts';
import type { LocalProviders, StackOptions } from '../types.ts';
import { contactDevSession, isMissingDevSession } from './connection.ts';
import { runDevControl } from './control.ts';
import { writeDevOutput } from './output.ts';
import { DevSessionError, DevSessionRecord, DevSessionUnavailableError } from './protocol.ts';
import { DEV_USAGE, devBinaryOptions, devOriginUrl } from './settings.ts';
import type { DevSettings } from './settings.ts';
import type { DevelopmentInput, DevelopmentPreparation } from './types.ts';

type RunDevSessionInput = { readonly settings: DevSettings; readonly hooks: DevelopmentInput };
type ReadDevSessionRecordInput = { readonly settings: DevSettings };
type DevOriginOptionsInput = { readonly settings: DevSettings; readonly record: DevSessionRecord | undefined };

type StartDevelopmentInput = RunDevSessionInput & {
  readonly record: DevSessionRecord | undefined;
  readonly providers: LocalProviders;
};

type VerifyAttachedSessionInput = { readonly settings: DevSettings; readonly record: DevSessionRecord | undefined };
type ReportInactiveDevSessionInput = { readonly settings: DevSettings; readonly record: DevSessionRecord | undefined };

export async function runDevSession({ settings, hooks }: RunDevSessionInput): Promise<number> {
  if (settings.command.command === 'help') {
    writeDevOutput({
      text:
        `${DEV_USAGE}\n` +
        'Start options: --model=fixture|live --github=fixture|live (both default to fixture)\n' +
        'test NAME runs a scenario provided by this development composition.\n',
    });

    return 0;
  }

  const record = await readDevSessionRecord({ settings });

  switch (settings.command.command) {
    case 'start':
      try {
        return await contactDevSession({
          socketPath: settings.socketPath,
          request: { command: 'status' },
          onConnected: () => verifyAttachedSession({ settings, record }),
        });
      } catch (cause) {
        if (!(cause instanceof DevSessionUnavailableError)) {
          throw cause;
        }
      }

      await startDevelopment({ settings, hooks, record, providers: settings.command.providers });

      return 0;
    case 'reset':
      await resetLocalState({ directory: settings.stateDirectory, environment: settings.environment });
      await rm(settings.socketPath, { force: true });
      await rmdir(settings.socketDirectory).catch((cause: unknown) => {
        if (!isMissingDevSession({ cause })) {
          throw cause;
        }
      });

      writeDevOutput({ text: `Removed inactive worktree state: ${settings.stateDirectory}\n` });

      return 0;
    case 'status':
      try {
        return await contactDevSession({ socketPath: settings.socketPath, request: settings.command });
      } catch (cause) {
        if (!(cause instanceof DevSessionUnavailableError)) {
          throw cause;
        }
      }

      return await reportInactiveDevSession({ settings, record });
    case 'cli':
    case 'test':
    case 'apply':
    case 'stop':
      return await contactDevSession({ socketPath: settings.socketPath, request: settings.command });
  }
}

async function startDevelopment({ settings, hooks, record, providers }: StartDevelopmentInput): Promise<void> {
  const origin = await devSessionOrigin({ settings, record });

  const preparation: DevelopmentPreparation =
    (await hooks.prepare?.({ origin, providers, environment: settings.environment })) ?? {};

  const options: StackOptions = {
    ...preparation.options,
    mode: 'persistent',
    stateDirectory: settings.stateDirectory,
    origin,
    environment: { ...settings.environment, ...preparation.options?.environment },
    providers,
    nodeExecutable: settings.nodeExecutable,
    ...devBinaryOptions({ settings }),
    isSource: true,
    isConsoleDevelopment: preparation.options?.isConsoleDevelopment ?? true,
    sandbox: 'container',
  };

  try {
    await runStackProgram({
      options,
      run: async ({ stack, signal }) => {
        await preparation.ready?.({ stack, signal });
        await runDevControl({ settings, stack, signal, runScenario: hooks.runScenario });
      },
    });
  } catch (cause) {
    try {
      await preparation.close?.();
    } catch (cleanupCause) {
      throw new AggregateError([cause, cleanupCause], 'Development and its composition cleanup failed', {
        cause: cleanupCause,
      });
    }

    throw cause;
  }

  await preparation.close?.();
}

async function readDevSessionRecord({ settings }: ReadDevSessionRecordInput): Promise<DevSessionRecord | undefined> {
  const contents = await readFile(settings.recordPath, 'utf8').catch((cause: unknown) => {
    if (isMissingDevSession({ cause })) {
      return;
    }

    throw cause;
  });

  if (contents === undefined) {
    return undefined;
  }

  const record = Schema.decodeUnknownSync(Schema.fromJsonString(DevSessionRecord), { onExcessProperty: 'error' })(
    contents,
  );

  if (
    record.worktreeDirectory !== settings.worktreeDirectory ||
    record.stateDirectory !== settings.stateDirectory ||
    record.socketPath !== settings.socketPath
  ) {
    throw new DevSessionError('The retained dev state belongs to another worktree');
  }

  return record;
}

async function reportInactiveDevSession({ settings, record }: ReportInactiveDevSessionInput): Promise<number> {
  const hasRetainedOwner = await access(settings.ownerRecordPath).then(
    () => true,
    (cause: unknown) => {
      if (isMissingDevSession({ cause })) {
        return false;
      }

      throw cause;
    },
  );

  if (hasRetainedOwner) {
    writeDevOutput({
      text: `${JSON.stringify({ status: 'unavailable', ownerRecordPath: settings.ownerRecordPath, lastSession: record })}\n`,
    });

    return 1;
  }

  writeDevOutput({
    text: `${JSON.stringify({ status: 'stopped', stateDirectory: settings.stateDirectory, lastSession: record })}\n`,
  });

  return 0;
}

async function devSessionOrigin({ settings, record }: DevOriginOptionsInput): Promise<URL> {
  if (settings.origin !== undefined) {
    return settings.origin;
  }

  if (record === undefined) {
    return await freeLocalOrigin();
  }

  return devOriginUrl({ origin: record.origin });
}

function verifyAttachedSession({ settings, record }: VerifyAttachedSessionInput): void {
  if (settings.command.command !== 'start' || record === undefined) {
    return;
  }

  for (const provider of settings.command.selectedProviders) {
    if (settings.command.providers[provider] !== record.providers[provider]) {
      throw new DevSessionError(`Stop the retained dev session before changing its ${provider} provider`);
    }
  }

  if (settings.origin !== undefined && settings.origin.origin !== record.origin) {
    throw new DevSessionError('Stop the retained dev session before changing its origin');
  }
}
