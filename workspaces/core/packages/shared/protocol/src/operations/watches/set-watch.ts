import { HttpMethod } from '@mechane/records';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { WatchPath } from '../schemas.ts';
import { WATCH_MUTATION_FAILURES } from './constants.ts';
import { Watch, WatchConfiguration } from './schemas.ts';

/** Creates or replaces a watch under a caller-chosen stable ID. */
export const setWatch = {
  method: HttpMethod.Post,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/watches/:watch_id',
  access: Access.Member,
  params: WatchPath,
  query: NoFields,
  body: WatchConfiguration,
  output: Watch,
  errors: WATCH_MUTATION_FAILURES,
} as const satisfies Operation;
