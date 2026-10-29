import { ORIGIN_VARIABLE } from '@mechane/deployment';
import { Option, Record } from 'effect';
import {
  CommandShape,
  DEFAULT_ORIGIN,
  DEFAULT_OUTPUT,
  FlagKind,
  OUTPUT_VARIABLE,
  OutputMode,
  PROGRAM,
  VERSION_COMMAND,
  WORKSPACE_VARIABLE,
} from './constants.ts';
import type { FlagDeclaration } from './types.ts';

/** A flag every command accepts, which a variable or a command word may stand in for. */
type GlobalFlagDeclaration = FlagDeclaration & {
  /** The environment variable that supplies the flag when the command line does not; none when no variable does. */
  readonly variable: Option.Option<string>;
  /** The command word that does what the flag does, which reads no deployment; none when no word does. */
  readonly command: Option.Option<string>;
};

/** The flags every command accepts, keyed by their long name. */
export const GLOBAL_FLAGS = {
  origin: {
    kind: FlagKind.Text,
    summary: [
      'the Mechane deployment to call, such as a local stack at http://127.0.0.1:9876,',
      `and ${DEFAULT_ORIGIN} when neither this flag nor its variable names one`,
    ].join(' '),
    variable: Option.some(ORIGIN_VARIABLE),
    command: Option.none(),
  },
  output: {
    kind: FlagKind.Text,
    summary: [
      `write the result as one of ${Record.values(OutputMode).join(', ')};`,
      `${DEFAULT_OUTPUT.onTerminal} on a terminal and ${DEFAULT_OUTPUT.elsewhere[CommandShape.Document]} elsewhere by default,`,
      `or ${DEFAULT_OUTPUT.elsewhere[CommandShape.Stream]} for a command that streams, which never writes json`,
    ].join(' '),
    variable: Option.some(OUTPUT_VARIABLE),
    command: Option.none(),
  },
  help: {
    kind: FlagKind.Switch,
    summary: 'print the commands, flags, variables and exit statuses',
    variable: Option.none(),
    command: Option.none(),
  },
  workspace: {
    kind: FlagKind.Text,
    summary: 'the workspace UUID for commands that act in a workspace; your personal workspace when absent',
    variable: Option.some(WORKSPACE_VARIABLE),
    command: Option.none(),
  },
  version: {
    kind: FlagKind.Switch,
    summary: `print the release, as ${PROGRAM} ${VERSION_COMMAND} does`,
    variable: Option.none(),
    command: Option.some(VERSION_COMMAND),
  },
} as const satisfies Readonly<Record<string, GlobalFlagDeclaration>>;
