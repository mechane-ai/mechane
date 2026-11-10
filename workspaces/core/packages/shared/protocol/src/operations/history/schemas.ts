import { PAGE_RENAMES, RecordId, RecordText, renamedWireStruct, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';

const MechHistoryEntryId = RecordId.pipe(Schema.brand('MechHistoryEntryId'));
/** Opaque position in one mech's combined imported and native history. */
export const MechHistoryCursor = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/u));
export type MechHistoryCursor = typeof MechHistoryCursor.Type;

/** Readable history projection with a stable entry identity and its available turn and time. */
const MechHistoryEntry = wireStruct({
  fields: {
    id: MechHistoryEntryId,
    kind: RecordText,
    text: RecordText,
    /** None when the recorded entry has no owning turn. */
    turnId: Schema.OptionFromNullOr(TurnId),
    /** None when the preserved or native entry carries no timestamp. */
    createdAt: Schema.OptionFromNullOr(WireTime),
  },
});

export type MechHistoryEntry = typeof MechHistoryEntry.Type;

/** Ordered history window whose cursor continues after the last returned entry. */
export const MechHistoryPage = renamedWireStruct({
  fields: {
    entries: Schema.Array(MechHistoryEntry),
    hasMore: Schema.Boolean,
    /** None when this page reaches the end of retained history. */
    nextCursor: Schema.OptionFromNullOr(MechHistoryCursor),
  },
  renames: PAGE_RENAMES,
});

export type MechHistoryPage = typeof MechHistoryPage.Type;
