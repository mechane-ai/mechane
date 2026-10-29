import { LocalSandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import { PROGRAM_ARGUMENTS_START } from '@mechane/program';
import { Effect, Option, Record } from 'effect';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StackFailed } from './errors.ts';
import { decodeStackSettings } from './settings/decode-stack-settings.ts';
import type { StackSettings, StackVariables } from './types.ts';

const INHERITED_VARIABLES = ['PATH', 'HOME', 'DOCKER_HOST'] as const;
const DEFAULT_LOCAL_ORIGIN = 'http://127.0.0.1:8787';

type LocalSettings = Pick<StackSettings, 'stateRoot' | 'localStateFolder'> & {
  readonly localOrigin: string;
  readonly localCommand: string;
};

/** Reads launcher arguments, persistent configuration, and declared Worker variables at the process boundary. */
export const loadStackSettings = Effect.fn('loadStackSettings')(function* (): Effect.fn.Return<
  StackSettings,
  StackFailed
> {
  const inheritedValue: (name: string) => readonly [string, Option.Option<string>] = (name) => [
    name,
    Option.fromNullishOr(process.env[name]),
  ];

  const inheritedEntries = INHERITED_VARIABLES.map(inheritedValue);
  const inheritedOptions = Record.fromEntries(inheritedEntries);
  const inherited = Record.getSomes(inheritedOptions);

  const workerValue: (name: string) => Option.Option<string> = (name) => Option.fromNullishOr(process.env[name]);
  const workerOptions = Record.map(WORKER_VARIABLES, workerValue);
  const workerVariables: StackVariables = Record.getSomes(workerOptions);

  const provider = Option.getOrElse(
    Option.fromNullishOr(workerVariables.sandboxProvider),
    () => LocalSandboxProvider.Container,
  );

  const local = localSettings();

  return yield* decodeStackSettings({ inherited, ...local, workerVariables, sandboxProvider: provider });
});

function localSettings(): LocalSettings {
  const homeFolder = homedir();
  const defaultStateHome = join(homeFolder, '.local', 'state');
  const configuredStateHome = Option.fromNullishOr(process.env['XDG_STATE_HOME']);
  const stateHome = Option.getOrElse(configuredStateHome, () => defaultStateHome);
  const defaultStateFolder = join(stateHome, 'mechane');
  const configuredStateFolder = Option.fromNullishOr(process.env['MECHANE_LOCAL_STATE_DIR']);
  const localStateFolder = Option.getOrElse(configuredStateFolder, () => defaultStateFolder);
  const configuredOrigin = Option.fromNullishOr(process.env['MECHANE_LOCAL_ORIGIN']);
  const localOrigin = Option.getOrElse(configuredOrigin, () => DEFAULT_LOCAL_ORIGIN);
  const localCommand = process.argv.slice(PROGRAM_ARGUMENTS_START).join(' ');

  return { stateRoot: tmpdir(), localStateFolder, localOrigin, localCommand };
}
