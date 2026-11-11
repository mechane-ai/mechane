import { SHA256_PATTERN } from '@mechane/records';
import { Option, Record, Schema } from 'effect';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Environment, StackOptions } from './types.ts';

const DEFAULT_ORIGIN: Readonly<URL> = new URL('http://127.0.0.1:8787');

export function inheritedEnvironment(): Environment {
  const variables = Record.map(process.env, Option.fromNullishOr);

  return Record.getSomes(variables);
}

export function nodeExecutablePath(): string {
  return process.execPath;
}

function localStateDirectory(environment: Environment): string {
  return environment['MECHANE_LOCAL_STATE_DIR'] ?? join(homedir(), '.local', 'state', 'mechane');
}

const STACK_COMMANDS: ReadonlySet<string> = new Set(['start', 'fixture']);

const CelldBinarySettings = Schema.fromJsonString(
  Schema.Struct({
    executable: Schema.NonEmptyString,
    version: Schema.NonEmptyString,
    sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  }),
);

const RESET_ARGUMENT_COUNT = 4;

type StackSettings =
  | { readonly command: 'start'; readonly options: StackOptions }
  | { readonly command: 'reset'; readonly directory: string; readonly environment: Environment };

export function loadStackSettings(): StackSettings {
  const command = process.argv[2] ?? 'start';
  const environment = inheritedEnvironment();

  if (command === 'reset') {
    if (process.argv.length !== RESET_ARGUMENT_COUNT || process.argv[3] !== '--confirm') {
      throw new Error('Usage: stack reset --confirm; this deletes the inactive local installation');
    }

    return { command: 'reset', directory: localStateDirectory(environment), environment };
  }

  if (!STACK_COMMANDS.has(command)) {
    throw new Error('Usage: stack [start|fixture]');
  }

  const isEphemeral = command === 'fixture';

  const stateDirectory = localStateDirectory(environment);
  const origin = new URL(environment['MECHANE_LOCAL_ORIGIN'] ?? DEFAULT_ORIGIN.href);
  const nodeExecutable = environment['MECHANE_NODE_EXECUTABLE'] ?? process.execPath;

  const binary = environment['MECHANE_LOCAL_CELLD_BINARY'];
  const toolOptions = workerBinarySettings(binary);

  if (isEphemeral) {
    return {
      command: 'start',
      options: {
        mode: 'ephemeral',
        origin,
        environment,
        providers: { model: 'fixture', github: 'fixture' },
        nodeExecutable,
        isSource: true,
        ...toolOptions,
      },
    };
  }

  return {
    command: 'start',
    options: {
      mode: 'persistent',
      stateDirectory,
      origin,
      environment,
      providers: { model: 'fixture', github: 'fixture' },
      nodeExecutable,
      isSource: true,
      isConsoleDevelopment: true,
      ...toolOptions,
    },
  };
}

function workerBinarySettings(binary: string | undefined): Pick<StackOptions, 'celldBinary'> {
  if (binary === undefined) {
    return {};
  }

  return { celldBinary: Schema.decodeUnknownSync(CelldBinarySettings)(binary) };
}
