import { HttpMethod } from '@mechane/records';
import { ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { SlackInstallationDeletion, SlackInstallationPath } from './installations.schemas.ts';

/** Owners disable an installation while retaining its bindings and delivery history. */
export const deleteSlackInstallation = {
  method: HttpMethod.Delete,
  path: '/v1/workspaces/:workspace_id/slack-installations/:connection_id',
  access: Access.Member,
  params: SlackInstallationPath,
  query: NoFields,
  body: NoFields,
  output: SlackInstallationDeletion,
  errors: [ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
