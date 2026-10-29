import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ObjectUnavailable, WatchLimitReached, WatchNotFound } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WatchPath } from '../schemas.ts';
import { WatchStatus } from './constants.ts';
import { Watch } from './schemas.ts';

const WatchStatusBody = Schema.Struct({ status: Schema.Enum(WatchStatus) });

/** Pauses or resumes a saved watch without replacing its configuration. */
export const updateWatchStatus = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/watches/:watch_id/status',
  access: Access.Member,
  params: WatchPath,
  query: NoFields,
  body: WatchStatusBody,
  output: Watch,
  errors: [MechNotFound, WatchNotFound, WatchLimitReached, ObjectUnavailable],
} as const satisfies Operation;
