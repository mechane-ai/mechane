import { KeyName, NoFields } from '@mechane/protocol';
import { RecordId, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

/** The commands that create, list and revoke the account's keys. */
export const KEY_COMMANDS = {
  'key create': {
    summary: 'create a named key through an approval in the browser, and write its token to a private file',
    shape: CommandShape.Document,
    operations: ['startDeviceApproval', 'pollDeviceApproval'],
    flags: {
      'name': { kind: FlagKind.Text, summary: 'the name that tells the key apart, such as ci' },
      'key-file': { kind: FlagKind.Text, summary: 'the file the token goes to, readable only by its owner' },
    },
    arguments: [],
    input: renamedWireStruct({
      fields: { name: KeyName, keyFile: Schema.NonEmptyString },
      renames: { keyFile: 'key-file' },
    }),
  },
  'key list': {
    summary: 'list your keys, oldest first, with revoked and expired ones',
    shape: CommandShape.Document,
    operations: ['listKeys'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'key revoke': {
    summary: 'revoke one of your keys for good',
    shape: CommandShape.Document,
    operations: ['revokeKey'],
    flags: {},
    arguments: [{ name: 'key-id', summary: 'the id of the key, as mechane key list prints it' }],
    input: renamedWireStruct({ fields: { keyId: RecordId }, renames: { keyId: 'key-id' } }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
