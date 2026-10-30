import { HttpMethod, wireStruct, WorkspaceId } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { SlackInstallations } from './installations.schemas.ts';

/** Owners inspect Slack installations without resolving their credential references. */
export const listSlackInstallations = {
  method: HttpMethod.Get,
  path: '/v1/workspaces/:workspace_id/slack-installations',
  access: Access.Member,
  params: wireStruct({ fields: { workspaceId: WorkspaceId } }),
  query: NoFields,
  body: NoFields,
  output: SlackInstallations,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
