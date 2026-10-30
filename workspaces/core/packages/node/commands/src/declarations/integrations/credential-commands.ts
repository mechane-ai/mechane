import { IntegrationSecretReference, NoFields } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { OptionalSwitch } from '../switch.schemas.ts';

const CREDENTIAL_ARGUMENT = {
  name: 'reference',
  summary: 'the workspace credential reference used by an integration',
} as const;

/** Workspace owners supply values through files and receive only references and encryption metadata. */
export const CREDENTIAL_COMMANDS = {
  'credential put': {
    summary: 'encrypt a workspace credential from a private file without returning its value',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'putCredential'],
    flags: {
      'file': { kind: FlagKind.Text, summary: 'the file containing only the credential value' },
      'create-only': { kind: FlagKind.Switch, summary: 'refuse to overwrite an existing reference during an import' },
    },
    arguments: [CREDENTIAL_ARGUMENT],
    input: renamedWireStruct({
      fields: {
        secretReference: IntegrationSecretReference,
        file: Schema.NonEmptyString,
        isCreateOnly: OptionalSwitch,
      },
      renames: { secretReference: 'reference', isCreateOnly: 'create-only' },
    }),
  },
  'credential list': {
    summary: 'list workspace credential references and encryption key versions without exposing values',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listCredentials'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'credential delete': {
    summary: 'remove a workspace credential before subsequent integration requests',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'deleteCredential'],
    flags: {},
    arguments: [CREDENTIAL_ARGUMENT],
    input: renamedWireStruct({
      fields: { secretReference: IntegrationSecretReference },
      renames: { secretReference: 'reference' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
