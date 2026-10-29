import { decodeFile } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { WireKind } from '@mechane/program';
import type { Lock } from '@mechane/program';
import { catalog, EventType, FAILURE_FAMILY, FAMILY_STATUS, ServerFailure } from '@mechane/protocol';
import type { Operation } from '@mechane/protocol';
import { wireKey } from '@mechane/records';
import { Effect, Record } from 'effect';
import { TAG_FIELD } from './constants.ts';
import { fieldNames } from './fields/field-names.ts';
import { flagNames } from './flag-names.ts';
import { ReferenceNames } from './schemas.ts';
import { variableNames } from './variable-names.ts';

/** The command reference, from which the lock reads the CLI's command words, flags and variables. */
const REFERENCE_FILE = 'packages/node/cli/reference.json';

/** A code of the Worker's errors, or an error family, with the value it maps to. */
type MappedName = readonly [name: string, value: string | number];

/**
 * Every name a shipped format carries, as the source declares it now. For `/v1`, each operation's method and path, its
 * parts' fields and members, the error body's, each error code with its fields and family, and each family's HTTP
 * status. Then the CLI's error codes and exit statuses, each event type, each command and flag, and each variable a
 * shipped program reads.
 */
export const wireNames = Effect.fn('wireNames')(function* (): Effect.fn.Return<Lock, InputUnreadable> {
  const { fields, members } = fieldNames();
  const reference = yield* decodeFile({ path: REFERENCE_FILE, schema: ReferenceNames });
  const operationName: (operation: Operation) => string = ({ method, path }) => `${method} ${path}`;
  const mappedName: (mapped: MappedName) => string = ([name, value]) => `${name}=${value}`;

  const exitStatusName: (exitStatus: ReferenceNames['exitStatuses'][number]) => string = ({ name, status }) =>
    `${name}=${status}`;

  return {
    [WireKind.Operations]: Record.values(catalog).map(operationName),
    [WireKind.Fields]: fields,
    [WireKind.Members]: members,
    [WireKind.Errors]: errorNames(),
    [WireKind.Families]: Record.toEntries(FAMILY_STATUS).map(mappedName),
    [WireKind.CliErrors]: reference.errorCodes,
    [WireKind.ExitStatuses]: reference.exitStatuses.map(exitStatusName),
    [WireKind.Events]: Record.values(EventType),
    [WireKind.Commands]: reference.commands.map(({ name }) => name),
    [WireKind.Flags]: flagNames({ reference }),
    [WireKind.Variables]: variableNames({ reference }),
  };
});

/**
 * Each code the Worker answers with and each of its fields under its wire key, such as `KeyExpired.expires_at`. Then
 * each code's family, such as `KeyExpired=unauthenticated`, by which a client acts on the code.
 */
function errorNames(): ReadonlyArray<string> {
  /** An error's code, then each of its fields under the code. */
  const failureNames: (failure: (typeof ServerFailure.members)[number]) => ReadonlyArray<string> = (failure) => {
    const fieldName: (field: string) => string = (field) => `${failure.identifier}.${wireKey({ field })}`;
    const fields: Readonly<Record<string, unknown>> = failure.fields;

    return [
      failure.identifier,
      ...Record.keys(fields)
        .filter((field) => field !== TAG_FIELD)
        .map(fieldName),
    ];
  };

  const familyName: (mapped: MappedName) => string = ([code, family]) => `${code}=${family}`;

  return [...ServerFailure.members.flatMap(failureNames), ...Record.toEntries(FAILURE_FAMILY).map(familyName)];
}
