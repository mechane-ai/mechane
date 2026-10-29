import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import {
  ConnectionNotFound,
  MechNotFound,
  ObjectUnavailable,
  ToolGrantInvalid,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { RemoteToolNames, ToolGrant, ToolGrantPath } from './schemas.ts';

const ToolGrantRequest = Schema.Struct({ tools: RemoteToolNames });

/** Owners replace one mech selection with names from the connection's allowed set. */
export const grantTools = {
  method: HttpMethod.Put,
  path: '/v1/workspaces/:workspace_id/mechs/:mech_id/grants/:connection_id',
  access: Access.Member,
  params: ToolGrantPath,
  query: NoFields,
  body: ToolGrantRequest,
  output: ToolGrant,
  errors: [
    ObjectUnavailable,
    WorkspaceNotFound,
    WorkspaceOwnerRequired,
    ConnectionNotFound,
    MechNotFound,
    ToolGrantInvalid,
  ],
} as const satisfies Operation;
