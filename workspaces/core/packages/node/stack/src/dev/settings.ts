import { SHA256_PATTERN } from '@mechane/records';
import { Option, Record, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocalProviders } from '../types.ts';
import { DevApplyTarget, DevProvider, DevSessionError } from './protocol.ts';
import type { DevRequest } from './protocol.ts';
import type { DevelopmentSettingsInput } from './types.ts';

const PROGRAM_ARGUMENTS_START = 2;
const WORKTREE_HASH_CHARACTERS = 16;
const SOURCE_FACTORY_DIRECTORY = fileURLToPath(new URL('../../../../../../../', import.meta.url));
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

const DEV_STATE_NAMES = Object.freeze({
  record: 'dev-session.json',
  nextRecord: 'dev-session.next.json',
  owner: 'owner.json',
  cli: 'cli',
});

const CLI_ENVIRONMENT_VARIABLES: ReadonlySet<string> = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'TERM',
  'NO_COLOR',
  'FORCE_COLOR',
  'BROWSER',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XDG_RUNTIME_DIR',
  'DBUS_SESSION_BUS_ADDRESS',
]);

export const DEV_USAGE = 'Usage: dev [start|status|cli ...|test NAME|apply sandbox|apply guest|stop|reset --confirm]';

const CelldBinarySettings = Schema.fromJsonString(
  Schema.Struct({
    executable: Schema.NonEmptyString,
    version: Schema.NonEmptyString,
    sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  }),
);

type CelldBinarySettings = typeof CelldBinarySettings.Type;

type DevStartCommand = {
  readonly command: 'start';
  readonly providers: LocalProviders;
  readonly selectedProviders: ReadonlyArray<keyof LocalProviders>;
};

type DevCommand = DevRequest | DevStartCommand | { readonly command: 'reset' | 'help' };

export type DevSettings = {
  readonly command: DevCommand;
  readonly worktreeDirectory: string;
  readonly stateDirectory: string;
  readonly socketDirectory: string;
  readonly socketPath: string;
  readonly recordPath: string;
  readonly nextRecordPath: string;
  readonly ownerRecordPath: string;
  readonly cliConfigurationDirectory: string;
  readonly origin: URL | undefined;
  readonly environment: Readonly<Record<string, string>>;
  readonly cliEnvironment: Readonly<Record<string, string>>;
  readonly nodeExecutable: string;
  readonly celldBinary: CelldBinarySettings | undefined;
};

type ParseDevCommandInput = { readonly args: ReadonlyArray<string> };
type ParseProviderInput = { readonly args: ReadonlyArray<string>; readonly provider: keyof LocalProviders };
type DevWorktreeKeyInput = { readonly worktreeDirectory: string; readonly stateDirectory?: string };
type DevStateDirectoryPathInput = { readonly worktreeKey: string };
type DevSocketDirectoryPathInput = { readonly worktreeKey: string; readonly userId: number | undefined };
type DevSocketPathInput = { readonly socketDirectory: string };
type DevStateEntryPathInput = { readonly stateDirectory: string; readonly entry: keyof typeof DEV_STATE_NAMES };
type DevOriginUrlInput = { readonly origin: string };
type DevBinaryOptionsInput = { readonly settings: DevSettings };
type DevBinaryOptions = { readonly celldBinary?: CelldBinarySettings };

export function devSettings(input: DevelopmentSettingsInput = {}): DevSettings {
  const variables = Record.map(process.env, Option.fromNullishOr);
  const environment = input.environment ?? Record.getSomes(variables);
  const cliEnvironment = Record.filter(environment, (_value, name) => CLI_ENVIRONMENT_VARIABLES.has(name));
  const args = input.args ?? process.argv.slice(PROGRAM_ARGUMENTS_START);
  const command = parseDevCommand({ args });
  const worktreeDirectory = resolve(input.worktreeDirectory ?? SOURCE_FACTORY_DIRECTORY);
  const worktreeKey = devWorktreeKey({ worktreeDirectory });
  const defaultStateDirectory = devStateDirectoryPath({ worktreeKey });
  const stateDirectory = resolve(environment['MECHANE_LOCAL_STATE_DIR'] ?? defaultStateDirectory);
  const controlKey = devWorktreeKey({ worktreeDirectory, stateDirectory });
  const socketDirectory = devSocketDirectoryPath({ worktreeKey: controlKey, userId: process.getuid?.() });
  const socketPath = devSocketPath({ socketDirectory });
  const recordPath = devStateEntryPath({ stateDirectory, entry: 'record' });
  const nextRecordPath = devStateEntryPath({ stateDirectory, entry: 'nextRecord' });
  const ownerRecordPath = devStateEntryPath({ stateDirectory, entry: 'owner' });
  const cliConfigurationDirectory = devStateEntryPath({ stateDirectory, entry: 'cli' });
  const nodeExecutable = environment['MECHANE_NODE_EXECUTABLE'] ?? process.execPath;
  const configuredOrigin = environment['MECHANE_LOCAL_ORIGIN'];
  const configuredBinary = environment['MECHANE_LOCAL_CELLD_BINARY'];

  const origin: URL | undefined = (() => {
    if (configuredOrigin === undefined) {
      return;
    }

    return devOriginUrl({ origin: configuredOrigin });
  })();

  const celldBinary: CelldBinarySettings | undefined = (() => {
    if (configuredBinary === undefined) {
      return;
    }

    return Schema.decodeUnknownSync(CelldBinarySettings, { onExcessProperty: 'error' })(configuredBinary);
  })();

  return {
    command,
    worktreeDirectory,
    stateDirectory,
    socketDirectory,
    socketPath,
    recordPath,
    nextRecordPath,
    ownerRecordPath,
    cliConfigurationDirectory,
    origin,
    environment,
    cliEnvironment,
    nodeExecutable,
    celldBinary,
  };
}

function parseDevCommand({ args }: ParseDevCommandInput): DevCommand {
  const commandArguments: ReadonlyArray<string> = (() => {
    if (args[0] === '--') {
      return args.slice(1);
    }

    return args;
  })();

  const cliIndex = commandArguments.indexOf('cli');

  const optionArguments: ReadonlyArray<string> = (() => {
    if (cliIndex === -1) {
      return commandArguments;
    }

    return commandArguments.slice(0, cliIndex);
  })();

  const model = parseProvider({ args: optionArguments, provider: 'model' });
  const github = parseProvider({ args: optionArguments, provider: 'github' });

  const selectedProviders = optionArguments.flatMap((argument): ReadonlyArray<keyof LocalProviders> => {
    if (argument.startsWith('--model=')) {
      return ['model'];
    }

    if (argument.startsWith('--github=')) {
      return ['github'];
    }

    return [];
  });

  const remaining = commandArguments.filter((argument, index) => {
    if (cliIndex !== -1 && index > cliIndex) {
      return true;
    }

    return !argument.startsWith('--model=') && !argument.startsWith('--github=');
  });

  const command = remaining[0] ?? 'start';
  const operands = remaining.slice(1);

  if (selectedProviders.length > 0 && command !== 'start') {
    throw new DevSessionError('Provider flags apply to dev start');
  }

  switch (command) {
    case 'start':
      if (operands.length === 0) {
        return { command, providers: { model, github }, selectedProviders };
      }

      break;
    case 'status':
    case 'stop':
      if (operands.length === 0) {
        return { command };
      }

      break;
    case 'cli':
      return { command, args: operands };
    case 'test':
      if (operands.length === 1 && operands[0] !== undefined && operands[0] !== '') {
        return { command, name: operands[0] };
      }

      break;
    case 'apply':
      if (operands.length === 1 && Schema.is(DevApplyTarget)(operands[0])) {
        return { command, target: operands[0] };
      }

      break;
    case 'reset':
      if (operands.length === 1 && operands[0] === '--confirm') {
        return { command };
      }

      break;
    case '--help':
    case 'help':
      if (operands.length === 0) {
        return { command: 'help' };
      }

      break;
    default:
      break;
  }

  throw new DevSessionError(DEV_USAGE);
}

function parseProvider({ args, provider }: ParseProviderInput): DevProvider {
  const prefix = `--${provider}=`;
  const matches = args.filter((argument) => argument.startsWith(prefix));

  if (matches.length > 1) {
    throw new DevSessionError(`Select one --${provider} provider`);
  }

  const value = matches[0]?.slice(prefix.length) ?? 'fixture';

  return Schema.decodeUnknownSync(DevProvider, { onExcessProperty: 'error' })(value);
}

function devWorktreeKey({ worktreeDirectory, stateDirectory = '' }: DevWorktreeKeyInput): string {
  return createHash('sha256')
    .update(worktreeDirectory)
    .update('\0')
    .update(stateDirectory)
    .digest('hex')
    .slice(0, WORKTREE_HASH_CHARACTERS);
}

function devStateDirectoryPath({ worktreeKey }: DevStateDirectoryPathInput): string {
  return join(homedir(), '.local', 'state', 'mechane', 'dev', worktreeKey);
}

function devSocketDirectoryPath({ worktreeKey, userId }: DevSocketDirectoryPathInput): string {
  return join(tmpdir(), `mechane-dev-${userId ?? 'user'}-${worktreeKey}`);
}

function devSocketPath({ socketDirectory }: DevSocketPathInput): string {
  return join(socketDirectory, 'control.sock');
}

function devStateEntryPath({ stateDirectory, entry }: DevStateEntryPathInput): string {
  const name = DEV_STATE_NAMES[entry];

  return join(stateDirectory, name);
}

export function devOriginUrl({ origin }: DevOriginUrlInput): URL {
  const parsed = new URL(origin);
  const isLoopback = LOOPBACK_HOSTS.has(parsed.hostname);
  const isLocalEndpoint = parsed.protocol === 'http:' && isLoopback && parsed.port !== '';
  const hasAuthority = parsed.username !== '' || parsed.password !== '';
  const hasSuffix = parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '';

  if (!isLocalEndpoint || hasAuthority || hasSuffix) {
    throw new DevSessionError('The dev origin must be a loopback HTTP origin with a port');
  }

  return parsed;
}

export function devBinaryOptions({ settings }: DevBinaryOptionsInput): DevBinaryOptions {
  if (settings.celldBinary === undefined) {
    return {};
  }

  return { celldBinary: settings.celldBinary };
}
