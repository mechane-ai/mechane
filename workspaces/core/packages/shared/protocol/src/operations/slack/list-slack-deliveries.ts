import { HttpMethod, MechId, wireStruct, WorkspaceId } from '@mechane/records';
import { ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { SlackDeliveries } from './schemas.ts';

/** Lists the most recent durable Slack receipts for a workspace agent. */
export const listSlackDeliveries = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/slack-deliveries',
  access: Access.Member,
  params: wireStruct({ fields: { workspaceId: WorkspaceId, mechId: MechId } }),
  query: NoFields,
  body: NoFields,
  output: SlackDeliveries,
  errors: [ObjectUnavailable],
} as const satisfies Operation;
