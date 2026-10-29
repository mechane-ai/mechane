import { callMech } from '@mechane/bindings';
import { InboxItemConflict, MechArchived, MechNotFound } from '@mechane/protocol';
import type { catalog, InboxItem, ObjectUnavailable } from '@mechane/protocol';
import { MechId } from '@mechane/records';
import { InboxItemReceipt } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Puts an item in the mech's inbox as the caller sent it; the mech records it before it delivers it. */
export const sendInboxItem = Effect.fn('sendInboxItem')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.sendInboxItem>): Effect.fn.Return<
  InboxItem,
  MechNotFound | MechArchived | InboxItemConflict | ObjectUnavailable
> {
  const { workspaceId, mechId, inboxItemId, text, delivery } = input;
  const identity = MechId.make(mechId);

  const receipt = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.sendInboxItem({ inboxItemId, text, delivery, senderId: caller.principal.id }),
    answer: InboxItemReceipt,
  });

  return yield* Match.valueTags(receipt, {
    Received: ({ inboxItem }) => Effect.succeed(inboxItem),
    MechMissing: () => new MechNotFound({ mechId }),
    Conflicting: () => new InboxItemConflict({ inboxItemId }),
    Archived: () => new MechArchived({ mechId: identity }),
  });
});
