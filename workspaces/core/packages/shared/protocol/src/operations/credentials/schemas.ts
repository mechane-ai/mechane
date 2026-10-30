import { isWellFormedText, RecordText, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { IntegrationSecretReference } from '../connections/schemas.ts';

const CREDENTIAL_MAX_CHARS = 65_536;

/** Credential input is redacted before handlers receive it and bounded before encryption. */
export const CredentialValue = Schema.RedactedFromValue(
  Schema.NonEmptyString.check(isWellFormedText, Schema.isMaxLength(CREDENTIAL_MAX_CHARS)),
);

export type CredentialValue = typeof CredentialValue.Type;

/** A credential reference is resolved only inside the admitted workspace. */
export const CredentialPath = wireStruct({
  fields: { workspaceId: WorkspaceId, secretReference: IntegrationSecretReference },
});

export type CredentialPath = typeof CredentialPath.Type;

/** Stored metadata accepts historical reference names independently of current write limits. */
export const CREDENTIAL_METADATA_FIELDS = {
  secretReference: RecordText,
  keyVersion: Schema.NonEmptyString,
  createdAt: WireTime,
  updatedAt: WireTime,
} as const;

/** Owners can inspect key versions and timestamps without reading credential values. */
export const CredentialMetadata = wireStruct({ fields: CREDENTIAL_METADATA_FIELDS });

export type CredentialMetadata = typeof CredentialMetadata.Type;

/** Workspace discovery returns credential metadata without resolving any secret. */
export const CredentialList = Schema.Struct({ credentials: Schema.Array(CredentialMetadata) });

export type CredentialList = typeof CredentialList.Type;

/** Deletion acknowledges the reference whose integrations can no longer resolve a value. */
export const CredentialDeletion = wireStruct({ fields: { secretReference: RecordText } });

export type CredentialDeletion = typeof CredentialDeletion.Type;
