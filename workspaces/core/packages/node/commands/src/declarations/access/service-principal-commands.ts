import { ServiceSubject } from '@mechane/protocol';
import { renamedWireStruct, ServiceKeyId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

const SUBJECT_ARGUMENT = { name: 'subject', summary: 'the stable name of this service in the workspace' } as const;

/** Workspace owner commands for service identity and key administration. */
export const SERVICE_PRINCIPAL_COMMANDS = {
  'service-principal show': {
    summary: 'show the service principal and current key metadata in the selected workspace',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showWorkspaceServicePrincipal'],
    arguments: [SUBJECT_ARGUMENT],
    flags: {},
    input: wireStruct({ fields: { subject: ServiceSubject } }),
  },
  'service-principal rotate': {
    summary: 'provision or rotate a service credential and write its token to an owner-only file',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'rotateWorkspaceServiceKey'],
    arguments: [SUBJECT_ARGUMENT],
    flags: { 'key-file': { kind: FlagKind.Text, summary: 'the file for the new token, readable only by its owner' } },
    input: renamedWireStruct({
      fields: { subject: ServiceSubject, keyFile: Schema.NonEmptyString },
      renames: { keyFile: 'key-file' },
    }),
  },
  'service-principal revoke': {
    summary: 'revoke the named key of this service while preserving its identity',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'revokeWorkspaceServiceKey'],
    arguments: [SUBJECT_ARGUMENT, { name: 'key-id', summary: 'the key ID from service-principal show or rotate' }],
    flags: {},
    input: renamedWireStruct({
      fields: { subject: ServiceSubject, keyId: ServiceKeyId },
      renames: { keyId: 'key-id' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
