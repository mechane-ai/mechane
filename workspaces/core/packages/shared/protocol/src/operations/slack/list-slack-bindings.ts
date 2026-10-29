import { HttpMethod, wireStruct, WorkspaceId } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { SlackBindings } from './schemas.ts';

/** Lists the Slack bindings visible to the workspace member. */
export const listSlackBindings = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/slack-bindings',
  access: Access.Member,
  params: wireStruct({ fields: { workspaceId: WorkspaceId } }),
  query: NoFields,
  body: NoFields,
  output: SlackBindings,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
