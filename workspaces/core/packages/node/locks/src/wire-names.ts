import { decodeFile } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { managedOperations } from '@mechane/managed-protocol';
import { WireKind } from '@mechane/program';
import type { Lock } from '@mechane/program';
import { catalog, FAILURE_FAMILY, FAMILY_STATUS, ServerFailure } from '@mechane/protocol';
import { wireKey } from '@mechane/records';
import { Effect, Record } from 'effect';
import { TAG_FIELD } from './constants.ts';
import { fieldNames } from './fields/field-names.ts';
import { flagNames } from './flag-names.ts';
import { ReferenceNames } from './schemas.ts';
import { variableNames } from './variable-names.ts';

/** The command reference, from which the lock reads the CLI's command words, flags and variables. */
const REFERENCE_FILE = 'packages/node/cli/reference.json';

/** A declared service error code, or an error family, with the value it maps to. */
type MappedName = readonly [name: string, value: string | number];

/**
 * Inventory of public Managed Agents routes and private operator operations. The operator catalog also supplies the
 * field names, members, and error codes used by the CLI. Both share this release lock with commands, exit statuses,
 * events, and environment variables.
 */
export const wireNames = Effect.fn('wireNames')(function* (): Effect.fn.Return<Lock, InputUnreadable> {
  const { fields, members } = fieldNames();
  const reference = yield* decodeFile({ path: REFERENCE_FILE, schema: ReferenceNames });
  const operations = [...managedOperations, ...Record.values(catalog)].map(({ method, path }) => `${method} ${path}`);
  const mappedName: (mapped: MappedName) => string = ([name, value]) => `${name}=${value}`;

  const exitStatusName: (exitStatus: ReferenceNames['exitStatuses'][number]) => string = ({ name, status }) =>
    `${name}=${status}`;

  return {
    [WireKind.Operations]: operations,
    [WireKind.Fields]: fields,
    [WireKind.Members]: members,
    [WireKind.Errors]: errorNames(),
    [WireKind.Families]: Record.toEntries(FAMILY_STATUS).map(mappedName),
    [WireKind.CliErrors]: reference.errorCodes,
    [WireKind.ExitStatuses]: reference.exitStatuses.map(exitStatusName),
    [WireKind.Events]: [],
    [WireKind.Commands]: reference.commands.map(({ name }) => name),
    [WireKind.Flags]: flagNames({ reference }),
    [WireKind.Variables]: variableNames({ reference }),
  };
});

/**
 * Each code the service answers with and each of its fields under its wire key, such as `KeyExpired.expires_at`. Then
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
