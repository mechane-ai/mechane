import { HttpMethod, wireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CredentialAlreadyExists } from '../../errors/credential.errors.ts';
import {
  ObjectUnavailable,
  WorkerMisconfigured,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { CredentialMetadata, CredentialPath, CredentialValue } from './schemas.ts';

const CredentialWrite = wireStruct({
  fields: {
    value: CredentialValue,
    /** Omission permits replacement; true makes an import refuse an existing reference. */
    isCreateOnly: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  },
});

type CredentialWrite = typeof CredentialWrite.Type;

/** Owners replace a credential value; create-only imports preserve existing values. */
export const putCredential = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/credentials/:secret_reference',
  access: Access.Member,
  params: CredentialPath,
  query: NoFields,
  body: CredentialWrite,
  output: CredentialMetadata,
  errors: [ObjectUnavailable, WorkerMisconfigured, WorkspaceNotFound, WorkspaceOwnerRequired, CredentialAlreadyExists],
} as const satisfies Operation;
