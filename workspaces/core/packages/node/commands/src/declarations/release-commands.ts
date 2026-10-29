import { renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

/** The command that replaces an installed CLI with the latest release its deployment publishes. */
export const RELEASE_COMMANDS = {
  update: {
    summary:
      "replace this mechane with the deployment's latest release, once the binary's size and SHA-256 match its manifest",
    shape: CommandShape.Document,
    operations: [],
    flags: { check: { kind: FlagKind.Switch, summary: 'report the latest release without installing it' } },
    arguments: [],
    input: renamedWireStruct({
      fields: {
        /** Absent for an update that installs the latest release, as `false` says. */
        isCheckOnly: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
      },
      renames: { isCheckOnly: 'check' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
