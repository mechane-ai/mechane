import { HttpMethod, RecordId, wireStruct } from '@mechane/records';
import { KeyNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { KeyMetadata } from './schemas.ts';

const KeyParams = wireStruct({ fields: { keyId: RecordId } });

type KeyParams = typeof KeyParams.Type;

/** Revokes one of the caller's keys for good; revoking a revoked key keeps its first revocation time. */
export const revokeKey = {
  method: HttpMethod.Post,
  path: '/v1/keys/:key_id/revoke',
  access: Access.Principal,
  params: KeyParams,
  query: NoFields,
  body: NoFields,
  output: KeyMetadata,
  errors: [KeyNotFound, ObjectUnavailable],
} as const satisfies Operation;
