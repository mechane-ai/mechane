import { InboxItemId, PrincipalId, renamedWireStruct, TurnId, WatchId } from '@mechane/records';

/** A running scheduled turn whose deadline requires normal cancellation. */
export const ExpiredWatchCheck = renamedWireStruct({
  fields: { watchId: WatchId, inboxItemId: InboxItemId, turnId: TurnId, creatorId: PrincipalId },
  renames: {},
});

export type ExpiredWatchCheck = typeof ExpiredWatchCheck.Type;
