import { ArgumentsUnparsed, FlagsInvalid, InvocationKind, UsageInvalid } from '@mechane/cli-kernel';
import type { CommandInvocation, ProgramSettings, UsageProblem } from '@mechane/cli-kernel';
import {
  API_KEY_VARIABLE,
  COMMANDS,
  CommandShape,
  CONFIG_HOME_VARIABLE,
  DEFAULT_ORIGIN,
  GLOBAL_FLAGS,
  OUTPUT_VARIABLE,
  VERSION_COMMAND,
} from '@mechane/commands';
import type { OutputMode } from '@mechane/commands';
import { ORIGIN_VARIABLE } from '@mechane/deployment';
import type { Release } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Effect, Option, Record, Schema } from 'effect';
import { homedir } from 'node:os';
import { isatty } from 'node:tty';
import { parseArgs } from 'node:util';
import { decodeCommand } from './decode-command.ts';
import { decodeCredentials } from './decode-credentials.ts';
import { decodeOrigin } from './decode-origin.ts';
import { decodeOutput } from './decode-output.ts';
import { defaultOutput } from './default-output.ts';
import { parseOptions } from './parse-options.ts';
import { programSettings } from './program-settings.ts';

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- only an interface merges into ImportMeta
  interface ImportMeta {
    /** The release stamp a release compiles into a CLI binary with Bun's define; a run from source has none. */
    readonly mechaneStamp: unknown;
  }
}

/** A request for the commands, flags and variables, by `--help`. */
type HelpInvocation = { readonly kind: typeof InvocationKind.Help };

/** A request for the release the program reports, by `--version` or the version command. */
type VersionInvocation = { readonly kind: typeof InvocationKind.Version; readonly release: Release };

/** What one command line asks the program to do. */
type Invocation = HelpInvocation | VersionInvocation | CommandInvocation;

/** The file descriptor of standard output, whose kind decides the default output mode. */
const STDOUT_DESCRIPTOR = 1;

/** The index of the first argument a person typed, after the runtime's path and the program's. */
const ARGUMENTS_START = 2;

/** The flags as `parseArgs` returns them, with each switch decoded into a predicate name. */
const ParsedFlags = renamedWireStruct({
  fields: {
    /** Absent when the command line names no origin. */
    origin: Schema.OptionFromOptionalKey(Schema.String),
    /** Absent when the command line names no output mode. */
    output: Schema.OptionFromOptionalKey(Schema.String),
    /** Absent for a command line that asks for no help, as `false` says. */
    isHelpRequested: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
    /** Absent for a command line that asks for no release, as `false` says. */
    isVersionRequested: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  },
  renames: { isHelpRequested: 'help', isVersionRequested: 'version' },
});

type ParsedFlags = typeof ParsedFlags.Type;

/** A command line that names a command, decoded so far, and the program that runs it. */
type CommandInvocationInput = {
  readonly positionals: ReadonlyArray<string>;
  readonly values: Readonly<Record<string, unknown>>;
  readonly flags: ParsedFlags;
  /** None when neither the flag nor its variable names an output mode. */
  readonly outputText: Option.Option<string>;
  readonly isTerminal: boolean;
  readonly usageOutput: OutputMode;
  readonly program: ProgramSettings;
};

/**
 * Reads the command line and the environment once; it is the only code that reads either. The output mode decodes
 * first, as a document command's, so a later usage error is written in it, and again for the selected command's shape.
 */
export const loadInvocation = Effect.fn('loadInvocation')(function* (): Effect.fn.Return<Invocation, UsageInvalid> {
  const isTerminal = isatty(STDOUT_DESCRIPTOR);
  const fallback = defaultOutput({ isTerminal, shape: CommandShape.Document });
  const usage: (problem: UsageProblem) => UsageInvalid = (problem) => new UsageInvalid({ problem, output: fallback });
  const args = process.argv.slice(ARGUMENTS_START);
  const options = parseOptions();

  const { values, positionals } = yield* Effect.try({
    try: () => parseArgs({ args, options, allowPositionals: true }),
    catch: (cause) => new ArgumentsUnparsed({ reason: String(cause) }),
  }).pipe(Effect.mapError(usage));

  const isGlobal: (value: unknown, name: string) => boolean = (_, name) => Object.hasOwn(GLOBAL_FLAGS, name);

  const flagsInvalid: (error: Schema.SchemaError) => UsageInvalid = (error) =>
    new UsageInvalid({ problem: new FlagsInvalid({ reason: error.message }), output: fallback });

  const flags = yield* Schema.decodeUnknownEffect(ParsedFlags, { onExcessProperty: 'error' })(
    Record.filter(values, isGlobal),
  ).pipe(Effect.mapError(flagsInvalid));

  const outputText = Option.orElse(flags.output, () => Option.fromNullishOr(process.env[OUTPUT_VARIABLE]));
  const usageOutput = yield* decodeOutput({ text: outputText, isTerminal, shape: CommandShape.Document });
  const program = programSettings({ stamp: import.meta.mechaneStamp, executablePath: process.execPath });

  if (flags.isHelpRequested) {
    return { kind: InvocationKind.Help };
  }

  if (flags.isVersionRequested || positionals.join(' ') === VERSION_COMMAND) {
    return { kind: InvocationKind.Version, release: program.release };
  }

  return yield* commandInvocation({ positionals, values, flags, outputText, isTerminal, usageOutput, program });
});

/**
 * The command a command line names, with its input and its output mode for its shape. It adds the settings every
 * command reads: the deployment it calls, production's when nothing names one, and where its key comes from.
 */
const commandInvocation = Effect.fn('commandInvocation')(function* ({
  positionals,
  values,
  flags,
  outputText,
  isTerminal,
  usageOutput,
  program,
}: CommandInvocationInput): Effect.fn.Return<CommandInvocation, UsageInvalid> {
  const isCommandFlag: (value: unknown, name: string) => boolean = (_, name) => !Object.hasOwn(GLOBAL_FLAGS, name);
  const commandValues = Record.filter(values, isCommandFlag);
  const selected = yield* decodeCommand({ positionals, values: commandValues, output: usageOutput });
  const output = yield* decodeOutput({ text: outputText, isTerminal, shape: COMMANDS[selected.command].shape });
  const originVariable = Option.fromNullishOr(process.env[ORIGIN_VARIABLE]);

  const originText = Option.getOrElse(
    Option.orElse(flags.origin, () => originVariable),
    () => DEFAULT_ORIGIN,
  );

  const origin = yield* decodeOrigin({ text: originText, output });

  const credentials = yield* decodeCredentials({
    apiKey: Option.fromNullishOr(process.env[API_KEY_VARIABLE]),
    configHome: Option.fromNullishOr(process.env[CONFIG_HOME_VARIABLE]),
    home: homedir(),
    output,
  });

  return { kind: InvocationKind.Command, ...selected, origin, output, credentials, program };
});
