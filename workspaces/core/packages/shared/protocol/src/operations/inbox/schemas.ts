import { isWellFormedText, memberOrUnknown, RecordId, RecordText, Sequence, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { Delivery, INBOX_TEXT_MAX_CHARS } from './constants.ts';

/** What an inbox item says, which the mech's conversation receives as a message. */
export const InboxText = Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, INBOX_TEXT_MAX_CHARS));

export type InboxText = typeof InboxText.Type;

/**
 * An inbox item as the mech received it: what it says, how it reaches the mech, who sent it, and when. Its received
 * sequence is that of the event that recorded its receipt, after which the mech's log holds what followed.
 */
export const InboxItem = wireStruct({
  fields: {
    id: RecordId,
    text: RecordText,
    delivery: memberOrUnknown({ set: Delivery }),
    senderId: RecordId,
    receivedAt: WireTime,
    receivedSequence: Sequence,
  },
});

export type InboxItem = typeof InboxItem.Type;
