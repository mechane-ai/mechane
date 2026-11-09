import {
  MechId,
  PAGE_RENAMES,
  RecordId,
  RecordText,
  renamedWireStruct,
  Sequence,
  TurnId,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';

/** A publication retains its identity independently of its activation and transcript position. */
export const ConsoleMessageId = RecordId.pipe(Schema.brand('ConsoleMessageId'));

export type ConsoleMessageId = typeof ConsoleMessageId.Type;

/** The transcript distinguishes admitted user notices from explicit agent publications. */
export const ConsoleMessageRole = { User: 'user', Assistant: 'assistant' } as const;

/** Assistant messages exist only after the explicit Console publication tool succeeds. */
export const ConsoleMessage = wireStruct({
  fields: {
    id: ConsoleMessageId,
    mechId: MechId,
    /** None means a user sent the message outside an activation. */
    runId: Schema.OptionFromNullOr(TurnId),
    role: Schema.Enum(ConsoleMessageRole),
    text: RecordText,
    /** None means the message contains prose without structured presentation. */
    presentation: Schema.OptionFromNullOr(UnknownFields),
    createdAt: WireTime,
    sequence: Sequence,
  },
});

export type ConsoleMessage = typeof ConsoleMessage.Type;

/** A bounded public transcript page is ordered by its independent publication sequence. */
export const ConsoleMessagePage = renamedWireStruct({
  fields: {
    messages: Schema.Array(ConsoleMessage),
    hasMore: Schema.Boolean,
    /** None means the page has no older publication cursor. */
    beforeSequence: Schema.OptionFromNullOr(Sequence),
  },
  renames: PAGE_RENAMES,
});

export type ConsoleMessagePage = typeof ConsoleMessagePage.Type;
