import { HttpMethod } from '@mechane/records';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MECH_AUTHORITY_OPERATION } from '../mech-authority-operation.ts';
import { SourceGrantState } from './schemas.ts';

/** Only a current workspace owner may inspect a mech's repository authority. */
export const showSourceGrant = {
  ...MECH_AUTHORITY_OPERATION,
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/source/grant',
  body: NoFields,
  output: SourceGrantState,
} as const satisfies Operation;
