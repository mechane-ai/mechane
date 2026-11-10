import { HttpMethod, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import {
  MechNotFound,
  NotificationConflict,
  RequestConflict,
  RequestInvalid,
  WorkspaceSuspended,
} from '../../errors/errors.ts';
import { MechArchived } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { ConsoleMessage, ConsoleMessageId } from '../conversation/schemas.ts';
import { SelfMessageRequest, Wake, WakeId, WakeList, WakeRequest } from './schemas.ts';

const WakePath = wireStruct({ fields: { wakeId: WakeId } });
const MessagePath = wireStruct({ fields: { messageId: ConsoleMessageId } });
const WakeQuery = Schema.Struct({ after: Schema.OptionFromOptionalKey(WakeId) });

const ERRORS = [
  MechNotFound,
  MechArchived,
  RequestInvalid,
  RequestConflict,
  NotificationConflict,
  WorkspaceSuspended,
] as const;

export const SELF_OPERATIONS = {
  scheduleSelfWake: {
    method: HttpMethod.Post,
    path: '/api/v1/self/wakes/:wake_id',
    access: Access.Self,
    params: WakePath,
    query: NoFields,
    body: WakeRequest,
    output: Wake,
    errors: ERRORS,
  },
  showSelfWake: {
    method: HttpMethod.Get,
    path: '/api/v1/self/wakes/:wake_id',
    access: Access.Self,
    params: WakePath,
    query: NoFields,
    body: NoFields,
    output: Wake,
    errors: ERRORS,
  },
  listSelfWakes: {
    method: HttpMethod.Get,
    path: '/api/v1/self/wakes',
    access: Access.Self,
    params: NoFields,
    query: WakeQuery,
    body: NoFields,
    output: WakeList,
    errors: ERRORS,
  },
  cancelSelfWake: {
    method: HttpMethod.Post,
    path: '/api/v1/self/wakes/:wake_id/cancel',
    access: Access.Self,
    params: WakePath,
    query: NoFields,
    body: NoFields,
    output: Wake,
    errors: ERRORS,
  },
  publishSelfMessage: {
    method: HttpMethod.Post,
    path: '/api/v1/self/messages/:message_id',
    access: Access.Self,
    params: MessagePath,
    query: NoFields,
    body: SelfMessageRequest,
    output: ConsoleMessage,
    errors: ERRORS,
  },
} as const satisfies Readonly<Record<string, Operation>>;
