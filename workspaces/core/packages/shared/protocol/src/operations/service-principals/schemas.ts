import { PrincipalId, RecordName, ServiceKeyId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { SERVICE_KEY_TOKEN_PATTERN } from '../auth/constants.ts';

const SUBJECT_MAX_CHARS = 128;
const SUBJECT_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/u;

/** A stable workspace-local subject chosen by the owner of an integration. */
export const ServiceSubject = Schema.String.check(
  Schema.isMaxLength(SUBJECT_MAX_CHARS),
  Schema.isPattern(SUBJECT_PATTERN),
);

export type ServiceSubject = typeof ServiceSubject.Type;

/** A service key travels on the public Managed Agents API and stays redacted in process. */
const ServiceKeyToken = Schema.RedactedFromValue(Schema.String.check(Schema.isPattern(SERVICE_KEY_TOKEN_PATTERN)));

const serviceKeyFields = { keyId: ServiceKeyId, expiresAt: WireTime } as const;
const ActiveServiceKey = wireStruct({ fields: serviceKeyFields });

/** Service identity and current key metadata available to the workspace owner. */
export const WorkspaceServicePrincipal = wireStruct({
  fields: {
    principalId: PrincipalId,
    subject: RecordName,
    /** Absent when the service has no current, unrevoked credential. */
    activeKey: Schema.OptionFromNullOr(ActiveServiceKey),
  },
});

export type WorkspaceServicePrincipal = typeof WorkspaceServicePrincipal.Type;

/** The rotation response is the only response containing the new credential. */
export const IssuedWorkspaceServiceKey = wireStruct({
  fields: { principalId: PrincipalId, ...serviceKeyFields, token: ServiceKeyToken },
});

export type IssuedWorkspaceServiceKey = typeof IssuedWorkspaceServiceKey.Type;

/** The key the owner addressed for revocation, including an already-revoked key. */
export const RevokedWorkspaceServiceKey = wireStruct({ fields: { keyId: ServiceKeyId } });
export type RevokedWorkspaceServiceKey = typeof RevokedWorkspaceServiceKey.Type;
