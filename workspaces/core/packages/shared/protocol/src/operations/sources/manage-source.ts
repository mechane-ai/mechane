import { HttpMethod } from '@mechane/records';
import {
  MechBusy,
  MechNotFound,
  ObjectUnavailable,
  RequestInvalid,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { SourceReport, SourceRequest } from './schemas.ts';

/** Each source operation requires live owner membership and returns progress without credential material. */
export const manageSource = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/source',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: SourceRequest,
  output: SourceReport,
  errors: [MechNotFound, MechBusy, ObjectUnavailable, RequestInvalid, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
