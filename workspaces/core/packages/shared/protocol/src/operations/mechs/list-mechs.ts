import { HttpMethod, RecordId, searchableListQuery } from '@mechane/records';
import { Schema } from 'effect';
import { RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WorkspacePath } from '../workspaces/schemas.ts';
import { MechStatus } from './constants.ts';
import { MechPage } from './schemas.ts';

const Filter = Schema.Enum(MechStatus);

/** Lists the workspace's mechs a page at a time, oldest first. */
export const listMechs = {
  method: HttpMethod.Get,
  path: '/api/operator/workspaces/:workspace_id/mechs',
  access: Access.Owner,
  params: WorkspacePath,
  query: searchableListQuery({ cursor: RecordId, filter: Filter }),
  body: NoFields,
  output: MechPage,
  errors: [RequestInvalid, ServiceUnavailable],
} as const satisfies Operation;
