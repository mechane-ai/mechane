import { HttpMethod } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { MechNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { MechRevisionPage } from './schemas.ts';

const MechRevisionQuery = Schema.Struct({
  after: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('0')),
  ),
});

/** Lists saved definitions after an exclusive revision cursor. */
export const listMechRevisions = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/revisions',
  access: Access.Member,
  params: MechPath,
  query: MechRevisionQuery,
  body: NoFields,
  output: MechRevisionPage,
  errors: [MechNotFound, ObjectUnavailable],
} as const satisfies Operation;
