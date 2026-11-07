import { Option, Record } from 'effect';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Environment, StackOptions } from './types.ts';

export const DEFAULT_SERVER_ENTRY = fileURLToPath(new URL('../../server/.output/server.mjs', import.meta.url));
const DEFAULT_ORIGIN: Readonly<URL> = new URL('http://127.0.0.1:8787');

export function inheritedEnvironment(): Environment {
  const variables = Record.map(process.env, Option.fromNullishOr);

  return Record.getSomes(variables);
}

export function nodeExecutablePath(): string {
  return process.execPath;
}

const STACK_COMMANDS: ReadonlySet<string> = new Set(['start', 'fixture']);

export function loadStackSettings(): StackOptions {
  const command = process.argv[2] ?? 'start';

  if (!STACK_COMMANDS.has(command)) {
    throw new Error('Usage: stack [start|fixture]');
  }

  const environment = inheritedEnvironment();
  const useFixtures = command === 'fixture';
  const stateDirectory = environment['MECHANE_LOCAL_STATE_DIR'] ?? join(homedir(), '.local', 'state', 'mechane');
  const origin = new URL(environment['MECHANE_LOCAL_ORIGIN'] ?? DEFAULT_ORIGIN.href);
  const nodeExecutable = environment['MECHANE_NODE_EXECUTABLE'] ?? process.execPath;

  if (useFixtures) {
    return { mode: 'ephemeral', origin, environment, useFixtures, nodeExecutable };
  }

  return { mode: 'persistent', stateDirectory, origin, environment, useFixtures, nodeExecutable };
}
