import { KeyList, KeyMetadata, Principal, Workspace } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CredentialSource } from '../constants.ts';

/** What `mechane auth login` reports: the account, its new login key, and the file that saved it, never the token. */
const LoginResult = wireStruct({
  fields: { origin: Schema.String, principal: Principal, key: KeyMetadata, credentialsFile: Schema.String },
});

type LoginResult = typeof LoginResult.Type;

/** What `mechane auth logout` reports: the login key it revoked, and the saved login it removed. */
const LogoutResult = wireStruct({
  fields: { origin: Schema.String, key: KeyMetadata, credentialsFile: Schema.String },
});

type LogoutResult = typeof LogoutResult.Type;

/** What `mechane auth status` reports: the account, the key the CLI sent and where it came from, and the workspaces. */
const StatusResult = wireStruct({
  fields: {
    origin: Schema.String,
    credentialSource: Schema.Enum(CredentialSource),
    principal: Principal,
    key: KeyMetadata,
    workspaces: Schema.Array(Workspace),
  },
});

type StatusResult = typeof StatusResult.Type;

/** What `mechane key create` reports: the new key and the file that holds its token, never the token. */
const KeyCreateResult = wireStruct({ fields: { principal: Principal, key: KeyMetadata, keyFile: Schema.String } });

type KeyCreateResult = typeof KeyCreateResult.Type;

/** Credential outputs expose metadata and saved-file paths without bearer tokens. */
export const ACCESS_OUTPUTS = {
  'auth login': LoginResult,
  'auth status': StatusResult,
  'auth logout': LogoutResult,
  'key create': KeyCreateResult,
  'key list': KeyList,
  'key revoke': KeyMetadata,
} as const;
