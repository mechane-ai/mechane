import { HttpMethod, InboxItemRequestId, MechId, SessionId, wireStruct, WorkspaceId } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { InboxItemConflict, MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { MechArchived } from '../../errors/mech.errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { Delivery } from './constants.ts';
import { InboxItem, InboxText } from './schemas.ts';

/** The path of one inbox item of a mech; the caller makes the item's id, so a retried send names the same item. */
const InboxItemPath = wireStruct({
  fields: { workspaceId: WorkspaceId, mechId: MechId, inboxItemId: InboxItemRequestId },
});

type InboxItemPath = typeof InboxItemPath.Type;

/** A send targets one conversation; omitting its identity selects the mech's default conversation. */
const SendInboxItemBody = wireStruct({
  fields: {
    text: InboxText,
    sessionId: Schema.optionalKey(SessionId),
    delivery: Schema.Enum(Delivery).pipe(Schema.withDecodingDefaultKey(Effect.succeed(Delivery.WhenIdle))),
  },
});

type SendInboxItemBody = typeof SendInboxItemBody.Type;

/**
 * Puts an item in a mech's inbox, which the mech takes up once it is idle. Sending the same id and text again answers
 * with the item already received, and delivers it once.
 */
export const sendInboxItem = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/inbox/:inbox_item_id',
  access: Access.Member,
  params: InboxItemPath,
  query: NoFields,
  body: SendInboxItemBody,
  output: InboxItem,
  errors: [MechNotFound, MechArchived, InboxItemConflict, ServiceUnavailable],
} as const satisfies Operation;
