import { HttpMethod, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { EventCursor } from '../events/schemas.ts';
import { MechPath } from '../schemas.ts';
import { ConsoleMessagePage } from './schemas.ts';

const ConversationCursor = Schema.OptionFromOptionalKey(EventCursor);

export const listConsoleMessages = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/conversation',
  access: Access.Member,
  params: MechPath,
  query: wireStruct({ fields: { beforeSequence: ConversationCursor, afterSequence: ConversationCursor } }),
  body: NoFields,
  output: ConsoleMessagePage,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;
