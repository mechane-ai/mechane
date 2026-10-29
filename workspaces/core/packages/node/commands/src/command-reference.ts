import { RELEASE } from '@mechane/protocol';
import { Option, Record, SchemaAST } from 'effect';
import { COMMANDS } from './commands.ts';
import { ErrorCode, ExitStatus, PROGRAM } from './constants.ts';
import { GLOBAL_FLAGS } from './global-flags.ts';
import type { CommandReference } from './schemas.ts';
import type { CommandDeclaration, FlagDeclaration } from './types.ts';
import { VARIABLES } from './variables.ts';

/** A command as the reference publishes it. */
type ReferenceCommand = CommandReference['commands'][number];

/** A flag of one command as the reference publishes it. */
type ReferenceCommandFlag = ReferenceCommand['flags'][number];

type RequiredFieldsInput = { readonly input: CommandDeclaration['input'] };

/** The version of the command reference document; a consumer reads it before any other field. */
const REFERENCE_SCHEMA_VERSION = 4;

/** The reference of every command, flag, variable, exit status and error code the model declares, in declared order. */
export function commandReference(): CommandReference {
  const referenceCommand: (entry: readonly [string, CommandDeclaration]) => ReferenceCommand = ([name, command]) => {
    const required = requiredFields({ input: command.input });

    const referenceFlag: (entry: readonly [string, FlagDeclaration]) => ReferenceCommandFlag = ([flagName, flag]) => ({
      name: flagName,
      ...flag,
      isRequired: required.has(flagName),
    });

    const { summary, shape, operations } = command;

    return {
      name,
      summary,
      shape,
      operations,
      flags: Record.toEntries(command.flags).map(referenceFlag),
      arguments: command.arguments,
    };
  };

  return {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    program: PROGRAM,
    release: RELEASE,
    flags: Record.toEntries(GLOBAL_FLAGS).map(([name, flag]) => ({ name, ...flag })),
    commands: Record.toEntries(COMMANDS).map(referenceCommand),
    variables: Record.toEntries(VARIABLES).map(([name, variable]) => ({ name, ...variable })),
    exitStatuses: Record.toEntries(ExitStatus).map(([name, status]) => ({ name, status })),
    errorCodes: Record.values(ErrorCode),
  };
}

/** The command-line names of the fields a command's input requires: those its encoded side does not mark optional. */
function requiredFields({ input }: RequiredFieldsInput): ReadonlySet<string> {
  const fields = Option.liftPredicate(SchemaAST.toEncoded(input.ast), SchemaAST.isObjects).pipe(
    Option.map((objects) => objects.propertySignatures),
    Option.getOrElse(() => []),
  );

  const isRequired: (field: SchemaAST.PropertySignature) => boolean = (field) => !SchemaAST.isOptional(field.type);

  return new Set(fields.filter(isRequired).map((field) => String(field.name)));
}
