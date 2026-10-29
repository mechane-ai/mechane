import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, ErrorCode, FlagKind } from './constants.ts';

/** What the reference says of every flag. */
const FLAG_FIELDS = { name: Schema.String, kind: Schema.Enum(FlagKind), summary: Schema.String } as const;

/** A global flag, with the variable and the command word that may stand in for it. */
const ReferenceFlag = Schema.Struct({
  ...FLAG_FIELDS,
  /** Absent when no variable stands in for the flag. */
  variable: Schema.OptionFromOptionalKey(Schema.String),
  /** Absent when no command word does what the flag does. */
  command: Schema.OptionFromOptionalKey(Schema.String),
});

/** A flag one command accepts, and whether the command requires it. */
const ReferenceCommandFlag = wireStruct({ fields: { ...FLAG_FIELDS, isRequired: Schema.Boolean } });

/** A positional argument a command requires after its words. */
const ReferenceArgument = Schema.Struct({ name: Schema.String, summary: Schema.String });

/** A command: its words, what it does, how it writes, what it calls, and its flags and arguments. */
const ReferenceCommand = Schema.Struct({
  name: Schema.String,
  summary: Schema.String,
  shape: Schema.Enum(CommandShape),
  operations: Schema.Array(Schema.String),
  flags: Schema.Array(ReferenceCommandFlag),
  arguments: Schema.Array(ReferenceArgument),
});

/** A variable the CLI reads that no flag supplies. */
const ReferenceVariable = Schema.Struct({ name: Schema.String, summary: Schema.String });

/** An exit status the process ends with, under its name. */
const ReferenceExitStatus = Schema.Struct({ name: Schema.String, status: Schema.Int });

/** The published command reference, generated from the command model alone. */
export const CommandReference = wireStruct({
  fields: {
    schemaVersion: Schema.Int,
    program: Schema.String,
    release: Schema.String,
    flags: Schema.Array(ReferenceFlag),
    commands: Schema.Array(ReferenceCommand),
    variables: Schema.Array(ReferenceVariable),
    exitStatuses: Schema.Array(ReferenceExitStatus),
    errorCodes: Schema.Array(Schema.Enum(ErrorCode)),
  },
});

export type CommandReference = typeof CommandReference.Type;
