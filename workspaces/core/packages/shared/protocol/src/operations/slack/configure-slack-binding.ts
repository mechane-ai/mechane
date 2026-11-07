import { HttpMethod, wireStruct, WorkspaceId } from '@mechane/records';
import { ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { SlackBinding, SlackBindingResult } from './schemas.ts';

/** Configures one fixed agent and audience, requiring live workspace ownership. */
export const configureSlackBinding = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/slack-bindings',
  access: Access.Member,
  params: wireStruct({ fields: { workspaceId: WorkspaceId } }),
  query: NoFields,
  body: SlackBinding,
  output: SlackBindingResult,
  errors: [ServiceUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired],
} as const satisfies Operation;
