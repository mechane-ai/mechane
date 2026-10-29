import type { MechTables } from '@mechane/mech-store';
import { EventType } from '@mechane/protocol';
import { Option } from 'effect';
import type { DateTime } from 'effect';

/** The tables a projection writes, the silent item pi wrote into the conversation, and when. */
type WriteSilentItemInput = { readonly store: MechTables; readonly inboxItemId: string; readonly now: DateTime.Utc };

/** Marks a silent item written, with its event the first time, and starts no turn. */
export function writeSilentItem({ store, inboxItemId, now }: WriteSilentItemInput): void {
  if (Option.isSome(store.writeInboxItem({ inboxItemId, now }))) {
    store.appendEvent({ event: { type: EventType.InboxItemWritten, inboxItemId }, now });
  }
}
