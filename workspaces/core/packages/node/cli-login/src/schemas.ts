import { KeyMetadata, KeyToken, Principal } from '@mechane/protocol';
import { wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { SAVED_LOGIN_SCHEMA_VERSION } from './constants.ts';

/** The saved login: the key `mechane auth login` received, the origin that issued it, and who it acts for. */
export const SavedLogin = wireStruct({
  fields: {
    schemaVersion: Schema.Literal(SAVED_LOGIN_SCHEMA_VERSION),
    origin: Schema.String,
    token: KeyToken,
    key: KeyMetadata,
    principal: Principal,
  },
});

export type SavedLogin = typeof SavedLogin.Type;
